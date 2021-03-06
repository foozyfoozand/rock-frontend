"""
Controller responsible for handling the scrolling
console box when we kick off jobs.
"""
from app import app, socketio, conn_mng, logger
from app.common import OK_RESPONSE
from flask import request, jsonify, Response
from flask_socketio import emit


@socketio.on('connect')
def connect():
    print('Client connected')


@socketio.on('disconnect')
def disconnect():
    print('Client disconnected')


@app.route('/api/get_console_logs/<job_name>', methods=['GET'])
def get_console_logs(job_name: str) -> Response:
    """
    Gets the console logs by Job name.

    :param job_name: The name of the job (EX: Kickstart or Kit)
    """
    logs = list(conn_mng.mongo_console.find({"jobName": job_name}, {'_id': False}))
    return jsonify(logs)


@app.route('/api/remove_console_output', methods=['POST'])
def remove_console_logs() -> Response:
    """
    Removes console logs based on teh jobName.

    :return: OK Response.
    """
    payload = request.get_json()
    conn_mng.mongo_console.delete_many({'jobName': payload['jobName']})
    return OK_RESPONSE
