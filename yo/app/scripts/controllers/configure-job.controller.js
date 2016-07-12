


(function(){
    'use strict';

    var app = angular.module('angularApp');

    app.controller('ConfigureJobController', function($q, $uibModalInstance, $uibModal, $scope, $rootScope, $uibModalStack, tc, inputEntities, facilityName){

        var that = this;
        var inputEntityTypes = _.uniq(_.map(inputEntities, 'entityType'));
        var inputContainsDatasets = _.includes(inputEntityTypes, 'dataset');
        var inputContainsDatafiles = _.includes(inputEntityTypes, 'datafile');
        var multipleInputEntities = inputEntities.length > 1;
        var inputDatasetTypes = [];
        var booleanGroupNames = [];
        this.numInputEntities = inputEntities.length;
        this.loadingJobTypes = true;
        this.form = {};
        getCompatibleJobTypes();

        this.submit = function() {

            that.form.$setSubmitted();

            if (that.form.$valid) {
                if (!multipleInputEntities){
                    that.submitJob(false);
                }  else if (this.selectedJobType.multiple !== true){
                    that.submitJob(true);
                } else {
                    this.confirmModal = $uibModal.open({
                        templateUrl : 'views/confirm-job-modal.html',
                        scope: $scope,
                        size : 'med'
                    })
                }
            }
        };

        this.submitJob = function(submitMultipleJobs) {
            var promises = [];
            var jobParameters = [];
            that.jobIds = [];
            that.failedSubmissions = [];

            if (this.confirmModal) this.confirmModal.close();
            that.isSubmitting = true;
            this.submittingModal = $uibModal.open({
                        templateUrl : 'views/submitting-job-modal.html',
                        scope: $scope,
                        size : 'med',
                        backdrop: 'static'
            });

            //Build all the job parameters from the configure job form
            _.each(that.selectedJobType.jobOptions, function (jobOption){
                    switch (jobOption.type) {
                        case "boolean":
                            if (jobOption.value === true) { jobParameters.push(jobOption.programParameter) }
                            break;
                        case "booleanGroup":
                            if (jobOption.value !== "") { jobParameters.push(jobOption.value) }
                            break;
                        default:
                            if (jobOption.value !== "") {
                                jobParameters.push(jobOption.programParameter);
                                jobParameters.push(jobOption.value);
                            }
                    }
            });

            if (submitMultipleJobs === true) {
                //If multiple jobs are to be submitted, the datasetIds and datafileIds params must be added for each submit
                _.each(inputEntities, function(inputEntity){
                    _.remove(jobParameters, function(jobParameter){
                            return String(jobParameter).match(/^--datafileIds=|^--datasetIds/);
                    });
                    if (inputEntity.entityType === 'datafile') jobParameters.unshift('--datafileIds=' + inputEntity.entityId);
                    if (inputEntity.entityType === 'dataset') jobParameters.unshift('--datasetIds=' + inputEntity.entityId);
                    promises.push(tc.ijp(facilityName).submitJob(that.selectedJobType.name, jobParameters).then(function(response){
                        that.jobIds.push(response.jobId);
                    }, function(response){
                        that.failedSubmissions.push({
                            inputEntityIds: inputEntity.entityId,
                            error: response || "No error response"
                        });
                    }));
                });

            } else {
                //If only one job is to be submitted, the datasetIds and datafileIds params are all added at once
                if (inputContainsDatafiles) jobParameters.unshift('--datafileIds=' + _.map(_.filter(inputEntities, function(o) { return o.entityType === 'datafile'}), 'entityId').join(','));
                if (inputContainsDatasets) jobParameters.unshift('--datasetIds=' + _.map(_.filter(inputEntities, function(o) { return o.entityType === 'dataset'}), 'entityId').join(','));
                promises.push(tc.ijp(facilityName).submitJob(that.selectedJobType.name, jobParameters).then(function(response){
                    that.jobIds.push(response.jobId);
                }, function(response){
                    that.failedSubmissions.push({
                        inputEntityIds: _.map(inputEntities, 'entityId').join(', '),
                        error: response || "No error response"
                    });
                }));
            }

            //Wait for all submits to resolve/reject before displaying results to user
            $q.all(promises).finally(function(){
                that.isSubmitting = false;
                $rootScope.$broadcast('jobSubmitted');
            });

        };

        this.close = function(thisModal){
            thisModal.$parent.$close();
        }

        this.jobTypeSelected = function(){
            that.form.$setPristine();
        }

        function getAllJobTypes(){
            var promises = [];
            var allJobTypes = [];
            return tc.ijp(facilityName).getJobType().then(function(jobTypeNames){
                _.each(jobTypeNames, function(jobTypeName){
                    promises.push(
                        tc.ijp(facilityName).getJobType(jobTypeName).then(function (jobType){
                            allJobTypes.push(jobType);
                        }, function(){
                            console.error("Failed to get job type data for " + jobTypeName);
                        })
                    );
                });
                return $q.all(promises).then(function(){
                    return allJobTypes;
                });
            }, function(){
                console.error("Failed to get job type names");
                return
            })
        }

        function getCompatibleJobTypes(){

            getAllJobTypes().then(function(allJobTypes){
                if (inputContainsDatasets) {
                    getInputDatasetTypes().then(function(inputDatasetTypes){

                        //Only include jobs that explicitly accept datasets
                        var compatibleJobTypes = _.filter(allJobTypes, function(jobType){ return jobType.acceptsDatasets});

                        //Filters the list of job types to only contain jobs that are compatible with all the input entity dataset types
                        compatibleJobTypes = _.filter(compatibleJobTypes, function(jobType){
                            return _.every(inputDatasetTypes, function(inputDatasetType){
                                return _.includes(jobType.datasetTypes, inputDatasetType);
                            });
                        });

                        //If there is more than one input entity, only includes jobs that have multiple = true
                        //EDIT: commented out for now, might want to run a job for each input entity, so don't need to filter by multiple
                        //if (multipleInputEntities) compatibleJobTypes = _.filter(compatibleJobTypes, function(jobType){ return jobType.multiple });

                        //Only include jobs that explicitly accept datafiles
                        if (inputContainsDatafiles) compatibleJobTypes = _.filter(compatibleJobTypes, function(jobType){ return jobType.acceptsDatafiles});

                        that.compatibleJobTypes = compatibleJobTypes;
                        that.selectedJobType = that.compatibleJobTypes[0] || "";
                        that.loadingJobTypes = false;
                        setupJobOptions();
                    });

                } else if (inputContainsDatafiles) {

                    //If the input entities include datafiles, the job type must explicitly accept datafiles
                    var compatibleJobTypes = _.filter(allJobTypes, function(jobType) { return jobType.acceptsDatafiles });

                    //EDIT: commented out for now, might want to run a job for each input entity, so don't need to filter by multiple
                    //If there is more than one input datafile, the job type must have multiple = true
                    if (multipleInputEntities) compatibleJobTypes = _.filter(compatibleJobTypes, function(jobType){ return jobType.multiple });

                    that.compatibleJobTypes = compatibleJobTypes;
                    that.selectedJobType = compatibleJobTypes[0] || "";
                    that.loadingJobTypes = false;
                    setupJobOptions();

                } else {
                    //If there is no input, show 'job-only' jobs, where neither datasets nor datafiles are accepted
                    var compatibleJobTypes = _.filter(allJobTypes, function(jobType) { return !(jobType.acceptsDatafiles || jobType.acceptsDatasets) });
                    that.compatibleJobTypes = compatibleJobTypes;
                    that.selectedJobType = compatibleJobTypes[0] || "";
                    that.loadingJobTypes = false;
                    setupJobOptions();
                }

            });

        }

        function getInputDatasetTypes(){
            var inputDatasets = _.filter(inputEntities, function(inputEntity){
                if (inputEntity.entityType === 'dataset') return true;
            });
            var inputDatasetIds = _.map(inputDatasets, 'entityId');

            var deferred = $q.defer();

            tc.icat(facilityName).query("select distinct dataset.type.name from Dataset dataset where dataset.id in ('" + inputDatasetIds.join("','") + "')").then(function(datasetTypes) {
                deferred.resolve(datasetTypes);
            }, function(error){
                deferred.reject(error);
            });
            return deferred.promise;
        }

        function setupJobOptions(){
            _.each(that.compatibleJobTypes, function(jobType){
                //Change structure of any 'boolean group' job options so they are more easily constructible in html
                //Find unique boolean group names
                var groupNames = _.uniq(_.filter(_.map(jobType.jobOptions, 'groupName'), undefined));
                _.each(groupNames, function(groupName){
                    //Find first option associated with that group, replace it with a single object containing all option information for that group,
                    //and remove all following objects associated with that group
                    var firstGroupMember = _.findIndex(jobType.jobOptions, function(option) { return option.groupName === groupName});
                    var newJobOption = {
                        groupName: groupName,
                        type: "booleanGroup",
                        programParameter: "",
                        values: []
                    };
                    _.each(_.filter(jobType.jobOptions, function(option){
                        return option.groupName === groupName;
                    }), function(groupJobOption) {
                        newJobOption.values.push({
                            name: groupJobOption.name,
                            programParameter: groupJobOption.programParameter
                        });
                    });
                    jobType.jobOptions[firstGroupMember] = newJobOption;
                    _.remove(jobType.jobOptions, function(option) { return option.groupName === groupName && option.type !== 'booleanGroup' });
                });

                _.each(jobType.jobOptions, function(option){
                    //Set up default values
                    switch (option.type) {
                        case "boolean":
                            option.value = option.defaultValue || false;
                            break;
                        case "integer":
                        case "float":
                            //isNaN check required instead of just ||, because option.defaultValue = false if defaultValue = 0
                            option.value = isNaN(parseFloat(option.defaultValue)) ? "" : parseFloat(option.defaultValue);
                            break;
                        case "string":
                            option.value = option.defaultValue || "";
                            break;
                        case "enumeration":
                            option.value = option.defaultValue || option.values[0];
                            break;
                        case "booleanGroup":
                            option.value = option.values[0].programParameter;
                    }
                });
            });
        }

    });

})();
