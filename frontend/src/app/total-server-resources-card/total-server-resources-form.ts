import { FormGroup } from "@angular/forms";
import { HtmlHidden } from "../html-elements";

export class TotalServerResources extends FormGroup {

    //These fields are not part of the form but they displayed on the componets interface.
    cpuCoresAvailable: number;
    memoryAvailable: number;
    clusterStorageAvailable: number;

    //Cached that holds the current cluster storage on a per hostname basis.
    serverDriveStorageCache: Object;

    assignedElasticSearchCpus: number;
    elasticSearchCss: string;
    elasticSearchErrorText: string;

    assignedLogstashCpus: number;
    logstashCss: string;
    logstashErrorText: string;
    
    elasticSearchMemCss: string;
    elasticSearchMemErrorText: string;
    assignedElasicSearchMemory: number;
    totalElasticSearchInstances: number;

    constructor(){
        super({}, null, null);
        this.initalize();

        super.addControl('log_stash_cpu_request', this.log_stash_cpu_request);
        super.addControl('elastic_search_cpu_request', this.elastic_search_cpu_request);
    }

    disable(opts?: {
        onlySelf?: boolean;
        emitEvent?: boolean;
    }): void {
        // Override do nothing!
    }

    private initalize(){
        this.cpuCoresAvailable = 0;
        this.memoryAvailable = 0;
        this.clusterStorageAvailable = 0;

        this.serverDriveStorageCache = {};

        this.assignedElasticSearchCpus = 0;
        this.elasticSearchErrorText = "";
        this.elasticSearchCss = "";

        this.assignedLogstashCpus = 0;
        this.logstashCss = "";
        this.logstashErrorText = "";

        this.assignedElasicSearchMemory = 0;
        this.elasticSearchMemCss = "";
        this.elasticSearchMemErrorText= "";
        this.totalElasticSearchInstances = 0;
    }

    /**
     * Overridden method
     */
    reset(value?: any, options?: {
        onlySelf?: boolean;
        emitEvent?: boolean;
    }): void {
        super.reset({});
        this.initalize();
    }

    log_stash_cpu_request = new HtmlHidden('log_stash_cpu_request', true);
    elastic_search_cpu_request = new HtmlHidden('elastic_search_cpu_request', true);

    public setAssignedLogstashCpus(assignedCpus: number) {
        this.assignedLogstashCpus = assignedCpus;
        this.log_stash_cpu_request.setValue(this.assignedLogstashCpus);
    }

    public setTotalElasticSearchInstances(elasticSearchInstances: number){
        this.totalElasticSearchInstances = elasticSearchInstances;
    }

    public setTotalAssignedElasticSearchCPUs(assignedCpus: number) {
        this.assignedElasticSearchCpus = assignedCpus;
    }

    public setAssignedElasticSearchCPURequest(assignedCpus: number){        
        this.elastic_search_cpu_request.setValue(assignedCpus);
    }

    /**
     * Called when a user clicks on the "Gather Facts" button on a given sensor or server
     * 
     * @param deviceFacts - The Ansible JSON object returned from the REST API.
     */
    public setFromDeviceFacts(deviceFacts: Object) {
        this.cpuCoresAvailable += deviceFacts["cpus_available"];
        this.memoryAvailable += deviceFacts["memory_available"];
    }

    /**
     * Called when we remove a sensor or server from the kit inventory list.
     * 
     * @param deviceFacts - The Ansible JSON object returned from the REST API.
     */
    public subtractFromDeviceFacts(deviceFacts: Object){
        if (deviceFacts){
            if (this.cpuCoresAvailable > 0){
                this.cpuCoresAvailable -= deviceFacts["cpus_available"];
            }
            
            if (this.memoryAvailable > 0){
                this.memoryAvailable -= deviceFacts["memory_available"];
            }
        }
    }

    /**
     * Subtracts the GBs from the selected sensorDriveStorageCache from the cache
     * and then sets the cache to for a specific host to 0.
     * 
     * @param deviceFacts - The Ansible JSON object returned from the REST API.
     */
    public removeClusterStorage(deviceFacts: Object){
        if (this.serverDriveStorageCache[deviceFacts["hostname"]] != undefined){
            if (this.clusterStorageAvailable > 0){
                this.clusterStorageAvailable -= this.serverDriveStorageCache[deviceFacts["hostname"]];
            }
        }
        this.serverDriveStorageCache[deviceFacts["hostname"]] = 0;
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
                    this.serverDriveStorageCache[deviceFacts["hostname"]] += clusterDrive["size_gb"];
                }
            }
        }
        this.clusterStorageAvailable += this.serverDriveStorageCache[deviceFacts["hostname"]];
    }

    /**
     * Sets the ElasicSearchInfo for the total server resources form.
     * 
     * @param elasticMasters - The number of masters from the advanced elasticsearch options form.
     * @param elasticDataNodes - The number of elastic data nodes from the advanced elasticsearch options form.
     * @param elasticCpus - Teh number of elasticSearch CPUs.
     * @param elasticMemory - 
     */
    public setErrorsOrSuccesses(elasticMasters: number,
                                elasticDataNodes: number,
                                elasticCpus: number,
                                elasticMemory: number
                               )
    {
        let total_instances = elasticMasters + elasticDataNodes;
        let cpus_required = total_instances * elasticCpus;
        let memory_required = total_instances * elasticMemory;
        
        if(this.cpuCoresAvailable < cpus_required) {
            this.elasticSearchCss = "text-danger";
            this.elasticSearchErrorText = ' - Error: Insufficient CPUs to support the selected value.';

            this.logstashCss = "text-danger";
            this.logstashErrorText = ' - Error: Insufficient CPUs to support the selected value for Logstash and Elasticsearch.';
        } else if (this.cpuCoresAvailable == cpus_required) {
            this.elasticSearchCss = "text-danger";
            this.elasticSearchErrorText = ' - Error: You cannot use all available CPUs for Elasticsearch/Logstash. Something has to be left for the system.';

            this.logstashCss = "text-danger";
            this.logstashErrorText = ' - Error: You cannot use all available CPUs for Elasticsearch/Logstash. Something has to be left for the system.';
        } else {
            this.elasticSearchCss = "text-success";
            this.elasticSearchErrorText = ' - Looks good!';

            this.logstashCss = "text-success";
            this.logstashErrorText = ' - Looks good';
        }
    
        if(elasticCpus == 0) {
            this.elasticSearchCss = "text-danger";
            this.elasticSearchErrorText = ' - Error: Elasticsearch CPUs must be non-zero!';
        }
                
        if(elasticMemory == 0) {
            this.elasticSearchMemCss = "text-danger";
            this.elasticSearchMemErrorText= ' - Error: Elasticsearch memory must be non-zero!';
        } else if (this.memoryAvailable < memory_required) {
            this.elasticSearchMemCss = "text-danger";
            this.elasticSearchMemErrorText= ' - Error: Insufficient server memory available.';
        } else if (this.memoryAvailable == memory_required) {
            this.elasticSearchMemCss = "text-danger";
            this.elasticSearchMemErrorText= ' - Error: You cannot use all memory available for Elasticsearch alone.';
        } else {
            this.elasticSearchMemCss = "text-success";
            this.elasticSearchMemErrorText= ' - Looks good!';
        }
    }
}