import { FormGroup, FormArray, FormControl } from '@angular/forms';
import { HtmlInput, HtmlHidden } from '../html-elements';
import { MIN_ONE_INVALID_FEEDBACK, 
         CONSTRAINT_MIN_ONE, 
         CIDR_CONSTRAINT,
         EXPLANATION } from '../frontend-constants';
import { SetSensorResourcesValidated } from '../kit-form/kit-form-globals';

export class HomeNetFormGroup extends FormGroup {
    constructor() {
        super({});
        super.addControl('home_net', this.home_net);
    }

    home_net = new HtmlInput(
        'home_net',
        'Home Net CIDR IP',
        "Enter your home net CIDR IP here.",
        'text',
        CIDR_CONSTRAINT,
        'You must enter a CIDR IP in the x.x.x.x/xx format.',
        true,
        '',
        "These are the values Bro and Suricata will use for their home nets. Home Nets \
         are the networks you are trying to protect.",
        undefined,
        undefined,
        true,
        'Remove',
        'btn btn-danger'
    )
}

/**
 * Main class which tracks the total resources for all of the sensors.
 */
export class SensorResourcesForm extends FormGroup {

    //These fields are not part of the form but they displayed on the componets interface.
    cpuCoresAvailable: number;
    memoryAvailable: number;    
    clusterStorageAvailable: number;    
    
    percentAllocated: number;
    kafkaCPUAllocation: number;
    molochCPUAllocation: number;
    broCPUAllocation: number;
    suricataCPUAllocation: number;
    zookeeperCPUAllocation: number;
    sensorDriveStorageCache: Object;

    //A cached value that we track for other calculations.
    private _lowest_cpus: number;

    constructor() {
        super({});
        this.cpuCoresAvailable = 0;
        this.memoryAvailable = 0;
        this.clusterStorageAvailable = 0;
        this.initializeAllocations();
        this.percentAllocated = 0;
        this.sensorDriveStorageCache = {};
        
        super.addControl('kafka_cpu_percentage', this.kafka_cpu_percentage);
        super.addControl('moloch_cpu_percentage', this.moloch_cpu_percentage);
        super.addControl('bro_cpu_percentage', this.bro_cpu_percentage);        
        super.addControl('suricata_cpu_percentage', this.suricata_cpu_percentage);
        super.addControl('zookeeper_cpu_percentage', this.zookeeper_cpu_percentage);
        super.addControl('home_nets', this.home_nets);
        this.addHomeNet();
        this.setPercentAllocated();

        super.addControl('kafka_cpu_request', this.kafka_cpu_request);
        super.addControl('moloch_cpu_request', this.moloch_cpu_request);
        super.addControl('bro_cpu_request', this.bro_cpu_request);        
        super.addControl('suricata_cpu_request', this.suricata_cpu_request);
        super.addControl('zookeeper_cpu_request', this.zookeeper_cpu_request);
        this._lowest_cpus = -1;
    }

    private setLowestCpus(lowest_cpus: number){
        this._lowest_cpus = lowest_cpus - 1;
    }

    public getLowestCpus(){
        return this._lowest_cpus;
    }

    /**
     * Sets allocations to zero.
     */
    private initializeAllocations(){
        this.kafkaCPUAllocation = 0;
        this.molochCPUAllocation = 0;
        this.broCPUAllocation = 0;
        this.suricataCPUAllocation = 0;
        this.zookeeperCPUAllocation = 0;
    }

    private _validateSensorResources(){
        if (this.percentAllocated >= 100 ){
            SetSensorResourcesValidated(false);
            return;
        }

        if (this._lowest_cpus <= 0){
            SetSensorResourcesValidated(false);
            return;
        }

        SetSensorResourcesValidated(true);
    }

    public setCPUAllocations() {
        if (this.cpuCoresAvailable > 1){
            this.kafkaCPUAllocation = this.setCPUAllocation(this.kafka_cpu_percentage.value);
            this.molochCPUAllocation = this.setCPUAllocation(this.moloch_cpu_percentage.value);
            this.broCPUAllocation = this.setCPUAllocation(this.bro_cpu_percentage.value);
            this.suricataCPUAllocation = this.setCPUAllocation(this.suricata_cpu_percentage.value);
            this.zookeeperCPUAllocation = this.setCPUAllocation(this.zookeeper_cpu_percentage.value);

            this.kafka_cpu_request.setValue(this.kafkaCPUAllocation * 1000);
            this.moloch_cpu_request.setValue(this.molochCPUAllocation * 1000);
            this.bro_cpu_request.setValue(this.broCPUAllocation * 1000);
            this.suricata_cpu_request.setValue(this.suricataCPUAllocation * 1000);
            this.zookeeper_cpu_request.setValue(this.zookeeperCPUAllocation * 1000);
        } else {
            //If CPU cores is 1 or less than we reinitalize everything ot 0.
            this.initializeAllocations();
        }

        this._validateSensorResources();
    }

    /**
     * Sets the total percent allocated accross all the allocations.
     * If the percentage exceeds 99 an error will display to the user.
     */
    public setPercentAllocated() {
        this.percentAllocated = (+this.kafka_cpu_percentage.value + 
                                 +this.moloch_cpu_percentage.value + 
                                 +this.bro_cpu_percentage.value + 
                                 +this.suricata_cpu_percentage.value + 
                                 +this.zookeeper_cpu_percentage.value);
    }

    /**
     * Called when a user clicks on the "Gather Facts" button on a given sensor
     * 
     * @param deviceFacts - The Ansible JSON object returned from the REST API.
     */
    public setFromDeviceFacts(deviceFacts: Object) {
        if (this._lowest_cpus == -1){
            this.setLowestCpus(deviceFacts["cpus_available"]);
        } else if (this._lowest_cpus > deviceFacts["cpus_available"]){
            this.setLowestCpus(deviceFacts["cpus_available"]);
        }
        
        this.cpuCoresAvailable += deviceFacts["cpus_available"];
        this.memoryAvailable += deviceFacts["memory_available"];
        this.memoryAvailable = parseFloat(this.memoryAvailable.toFixed(2));
        this.setCPUAllocations();
    }

    /**
     * Called when we remove a sensor from the kit inventory list.
     * 
     * @param deviceFacts - The Ansible JSON object returned from the REST API.
     */
    public subtractFromDeviceFacts(deviceFacts: Object){
        this.cpuCoresAvailable -= deviceFacts["cpus_available"];
        this.memoryAvailable -= deviceFacts["memory_available"];
        this.memoryAvailable = parseFloat(this.memoryAvailable.toFixed(2));
        this.setCPUAllocations();
    }

    /**
     * Subtracts the GBs from the selected sensorDriveStorageCache from the cache
     * and then sets the cache to for a specific host to 0.
     * 
     * @param deviceFacts - The Ansible JSON object returned from the REST API.
     */
    public removeClusterStorage(deviceFacts: Object){
        if (this.sensorDriveStorageCache[deviceFacts["hostname"]] != undefined){
            this.clusterStorageAvailable -= this.sensorDriveStorageCache[deviceFacts["hostname"]];
        } 
        this.sensorDriveStorageCache[deviceFacts["hostname"]] = 0;
    }

    /**
     * Calulates and stores the cluster storage based on what the user selected 
     * and the passed in deviceFacts object .
     * 
     * @param drivesSelected - An array of drives that have been selected
     * @param deviceFacts - The Ansible JSON object returned from the REST API.
     */
    public calculateClusterStorageAvailable(drivesSelected: Array<string>, deviceFacts: Object){
        this.removeClusterStorage(deviceFacts);

        for (let drive of drivesSelected){
            for (let clusterDrive of deviceFacts["disks"]) {
                if (drive === clusterDrive["name"]){
                    this.sensorDriveStorageCache[deviceFacts["hostname"]] += clusterDrive["size_gb"];
                }
            }
        }

        this.clusterStorageAvailable += this.sensorDriveStorageCache[deviceFacts["hostname"]];
    }


    /**
     * Private method that calculates a CPU allocation for the main display.
     * 
     * @param cpuPercentValue  
     */
    private setCPUAllocation(cpuPercentValue: number) : number {
        let allocationValue = this._lowest_cpus * (cpuPercentValue / 100)
        return parseFloat(allocationValue.toFixed(2));
    }

    /**
     * Adds a HomeNet FormGroup.
     */
    public addHomeNet(){
        this.home_nets.push(new HomeNetFormGroup());
    }

    /**
     * Removes a HomeNet FormGroup from the homeNets Array by index.
     * At least home net is required so we do not allow deletion of the
     * last homenet.
     * 
     * @param index 
     */
    public removeHomeNet(index: number){
        if (this.home_nets.length > 1){
            this.home_nets.removeAt(index);
        }
    }

    home_nets = new FormArray([]);
    //Request values that get set in the actual inventory file. They are hidden inputs on the html form document.
    kafka_cpu_request = new HtmlHidden('kafka_cpu_request', false);
    moloch_cpu_request = new HtmlHidden('kafka_cpu_request', false);
    bro_cpu_request = new HtmlHidden('kafka_cpu_request', false);
    suricata_cpu_request = new HtmlHidden('kafka_cpu_request', false);
    zookeeper_cpu_request= new HtmlHidden('kafka_cpu_request', false);

    kafka_cpu_percentage = new HtmlInput(
        'kafka_cpu_percentage',
        'Kafka CPU %',
        "% of CPUs for Kafka",
        'number',
        CONSTRAINT_MIN_ONE,
        MIN_ONE_INVALID_FEEDBACK,
        true,
        '13',
        "The percentage of the sensor cores which will be allocated to Kafka." + EXPLANATION
    )

    moloch_cpu_percentage = new HtmlInput(
        'moloch_cpu_percentage',
        'Moloch CPU %',
        "% of CPUs for Moloch",
        'number',
        CONSTRAINT_MIN_ONE,
        MIN_ONE_INVALID_FEEDBACK,
        true,
        '19',
        "The percentage of the sensor cores which will be allocated to moloch." + EXPLANATION
    )

    bro_cpu_percentage = new HtmlInput(
        'bro_cpu_percentage',
        'Bro CPU %',
        "% of CPUs for Bro",
        'number',
        CONSTRAINT_MIN_ONE,
        MIN_ONE_INVALID_FEEDBACK,
        true,
        '58',
        "The percentage of the sensor cores which will be allocated to Bro." + EXPLANATION
    )

    suricata_cpu_percentage = new HtmlInput(
        'suricata_cpu_percentage',
        'Suricata CPU %',
        "% of CPUs for Suricata",
        'number',
        CONSTRAINT_MIN_ONE,
        MIN_ONE_INVALID_FEEDBACK,
        true,
        '6',
        "The percentage of the sensor cores which will be allocated to Suricata." + EXPLANATION
    )

    zookeeper_cpu_percentage = new HtmlInput(
        'zookeeper_cpu_percentage',
        'Zookeeper CPU %',
        "% of CPUs for Zookeeper",
        'number',
        CONSTRAINT_MIN_ONE,
        MIN_ONE_INVALID_FEEDBACK,
        true,
        '3',
        "The percentage of the sensor cores which will be allocated to Zookeeper." + EXPLANATION
    )    
}