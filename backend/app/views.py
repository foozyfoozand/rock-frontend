"""
This is the main module for all the various rest calls
"""
import json
import traceback

from app import (app, logger, mongo_kickstart,
                 mongo_kickstart_archive, socketio,
                 mongo_console)
from app.node_facts import get_system_info
from app.inventory_generator import KickstartInventoryGenerator, KitInventoryGenerator
from app.job_manager import spawn_job
from app.socket_service import log_to_console
from datetime import datetime
from flask import request, jsonify, Response
from flask_socketio import send, emit
from pymongo.results import InsertOneResult
from typing import Dict, Tuple


MIN_MBPS = 1000
OK_RESPONSE = Response()
OK_RESPONSE.status_code = 200
KICKSTART_ID = {"_id": "kickstart_form"}


@socketio.on('connect')
def connect():
    print('Client connected')


@socketio.on('disconnect')
def disconnect():
    print('Client disconnected')


@socketio.on('message')
def handle_message(msg):
    print(msg)
    emit('message', {'message': msg})


@app.route('/api/gather_device_facts', methods=['POST'])
def gather_device_facts():
    """
    Gathers device facts or sends back a HTTP error to the
    user if something fails.

    :return: A jsonified response object.
    """
    try:
        payload = request.get_json()
        management_ip = payload.get('management_ip')
        password = payload.get('password')        
        node = get_system_info(management_ip, password)
        potential_monitor_interfaces = []

        for interface in node.interfaces:
            if interface.ip_address != management_ip:
                potential_monitor_interfaces.append(interface.name)            
            if interface.ip_address == management_ip:
                if interface.speed < MIN_MBPS:
                    return jsonify(error_message="ERROR: Please check your "
                                   "network configuration. The link speed on {} is less than {} Mbps."
                                   .format(interface.name, MIN_MBPS))
        
        return jsonify(cpus_available=node.cpu_cores,
                       memory_available=node.memory_gb,
                       disks= json.dumps([disk. __dict__ for disk in node.disks]),
                       hostname=node.hostname,
                       potential_monitor_interfaces=potential_monitor_interfaces,
                       interfaces=json.dumps([interface. __dict__ for interface in node.interfaces]))
    except Exception as e:
        #TODO Add logging later
        traceback.print_exc()
        return jsonify(error_message=str(e))


def _modify_advanced_settings(template_ctx: Dict) -> None:
    """
    If this is an online build and download dependencies is checked
    Lets configure the correct repos to be downloaded.
    everyone gets additional
    rhel will sync rhel repos
    centos will sync centos repo

    :param template_ctx:
    :return:
    """
    template_ctx['advanced_settings']['repo_sync_centos'] = False
    template_ctx['advanced_settings']['repo_sync_rhel'] = False
    template_ctx['advanced_settings']['repo_sync_additional'] = False

    try:
        template_ctx['advanced_settings']['download_dependencies']
    except KeyError:
        template_ctx['advanced_settings']['download_dependencies'] = False

    if (template_ctx['advanced_settings']['is_offline_build'] is False
            and template_ctx['advanced_settings']['download_dependencies'] is True):
        template_ctx['advanced_settings']['repo_sync_additional'] = True

        if template_ctx['advanced_settings']['os_name'] == "centos":
            template_ctx['advanced_settings']['repo_sync_centos'] = True

        if template_ctx['advanced_settings']['os_name'] == "rhel":
            template_ctx['advanced_settings']['repo_sync_rhel'] = True


@app.route('/api/generate_kickstart_inventory', methods=['POST'])
def generate_kickstart_inventory() -> Response:
    """
    Generates the Kickstart inventory file from a JSON object that was posted from the
    Angular frontend component.

    :return:
    """
    payload = request.get_json()
    _modify_advanced_settings(payload)

    logger.debug(json.dumps(payload, indent=4, sort_keys=True))
    mongo_kickstart.find_one_and_replace(KICKSTART_ID,
                                         {"_id": "kickstart_form", "payload": payload},
                                         upsert=True)  # type: InsertOneResult

    kickstart_generator = KickstartInventoryGenerator(payload)
    kickstart_generator.generate()

    spawn_job("Kickstart",
              "make",
              ["kickstart"],
              log_to_console,
              working_directory="/opt/tfplenum-deployer/playbooks")
    return OK_RESPONSE


@app.route('/api/remove_and_archive_kickstart', methods=['POST'])
def remove_and_archive() -> Response:
    """
    Removes the kickstart inventory from the main collection and then
    archives it in a separate collection.

    :return:
    """
    kickstart_form = mongo_kickstart.find_one(KICKSTART_ID)
    if kickstart_form is not None:
        del kickstart_form['_id']
        kickstart_form['archive_date'] = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        mongo_kickstart_archive.insert_one(kickstart_form)
        mongo_kickstart.delete_one(KICKSTART_ID)
    return OK_RESPONSE


@app.route('/api/get_kickstart_form', methods=['GET'])
def get_kickstart_form() -> Response:
    """
    Gets the Kickstart form that was generated by the user on the Kickstart
    configuration page.

    :return:
    """
    mongo_document = mongo_kickstart.find_one({"_id": "kickstart_form"})
    if mongo_document is None:
        return OK_RESPONSE

    mongo_document['_id'] = str(mongo_document['_id'])
    return jsonify(mongo_document["payload"])


def _set_sensor_type_counts(payload: Dict) -> None:
    sensor_remote_count = 0
    sensor_local_count = 0

    for sensor in payload["sensors"]:
        if sensor['sensor_type'] == "Remote":
            sensor_remote_count += 1
        else:
            sensor_local_count += 1

    payload["sensor_local_count"] = sensor_local_count
    payload["sensor_remote_count"] = sensor_remote_count    


@app.route('/api/generate_kit_inventory', methods=['POST'])
def generate_kit_inventory() -> Response:
    """
    Generates the kit inventory file which will be used in provisioning the system.

    :return: Response object
    """
    payload = request.get_json()
    payload['kubernetes_services_cidr'] = payload['kubernetes_services_cidr'] + "/28"
    payload['use_ceph_for_pcap'] = False
    if payload["sensor_storage_type"] == "Use Ceph clustered storage for PCAP":
        payload['use_ceph_for_pcap'] = True

    _set_sensor_type_counts(payload)
    logger.debug(json.dumps(payload, indent=4, sort_keys=True))
    kit_generator = KitInventoryGenerator(payload)
    kit_generator.generate()
    spawn_job("Kit",
              "make",
              ["kit"],
              log_to_console,
              working_directory="/opt/tfplenum/playbooks")
    return OK_RESPONSE


@app.route('/api/generate_kit_inventory/<job_name>', methods=['GET'])
def get_console_logs(job_name: str):
    logs = list(mongo_console.find({"jobName": job_name}, {'_id': False}))
    return jsonify(logs)


@app.route('/api/remove_console_output', methods=['POST'])
def remove_console_logs():
    payload = request.get_json()
    mongo_console.delete_many({'jobName': payload['jobName']})
    return OK_RESPONSE