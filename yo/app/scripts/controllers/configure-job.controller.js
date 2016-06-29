


(function(){
    'use strict';

    var app = angular.module('angularApp');

    app.controller('ConfigureJobController', function($q, $uibModalInstance, $uibModal, $scope, $rootScope, $uibModalStack, tc, cartItems){

        var that = this;
        var cartEntityTypes = _.uniq(_.map(cartItems, 'entityType'));
        var cartContainsDatasets = _.includes(cartEntityTypes, 'dataset');
        var cartContainsDatafiles = _.includes(cartEntityTypes, 'datafile');
        var multipleCartItems = cartItems.length > 1;
        var cartDatasetTypes = [];
        var booleanGroupNames = [];
        this.numCartItems = cartItems.length;
        this.loadingJobTypes = true;
        this.loadingJobOptions = true;
        this.form = {};

        getCompatibleJobTypes();

        this.submit = function() {

            that.form.$setSubmitted();

            if (that.form.$valid) {
                if (!multipleCartItems || this.selectedJobType.multiple !== true ) {
                    //If there is only one item in the cart, submitMultipleJobs() and submitSingleJob() will have the same effect
                    this.submitMultipleJobs();
                    $uibModalInstance.close('job submitted');
                } else {
                    this.confirmModal = $uibModal.open({
                        templateUrl : 'views/confirm-job-modal.html',
                        scope: $scope,
                        size : 'med'
                    })
                }
            }
        };

        this.submitSingleJob = function() {
            var jobParameters = [];

            if (cartContainsDatafiles) jobParameters.push('--datafileIds=' + _.map(cartItems, 'entityId').join(','));
            if (cartContainsDatasets) jobParameters.push('--datasetIds=' + _.map(cartItems, 'entityId').join(','));

            _.each(that.selectedJobType.jobOptions, function (jobOption){
                switch (jobOption.type) {
                    case "boolean":
                            if (jobOption.value === true) { jobParameters.push(String(jobOption.programParameter)) }
                        break;
                    case "booleanGroup":
                        if (jobOption.value !== "") { jobParameters.push(jobOption.value) }
                        break;
                    default:
                        if (jobOption.value !== "") {
                            jobParameters.push(jobOption.programParameter);
                            jobParameters.push(String(jobOption.value));
                        }
                }
            });
            tc.ijp(cartItems[0].facilityName).submitJob(this.selectedJobType.name, jobParameters);

            this.confirmModal.close('job submitted');
            $uibModalInstance.close('job submitted');

        };

        this.submitMultipleJobs = function() {

            _.each(cartItems, function(cartItem) {
                var jobParameters = [];

                if (cartItem.entityType === 'datafile') jobParameters.push('--datafileIds=' + cartItem.entityId);
                if (cartItem.entityType === 'dataset') jobParameters.push('--datasetIds=' + cartItem.entityId);

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
                console.log(jobParameters);
                tc.ijp(cartItem.facilityName).submitJob(that.selectedJobType.name, jobParameters);
            });

            if (this.confirmModal) this.confirmModal.close('job submitted');
            $uibModalInstance.close('job submitted');
        };

        this.cancel = function(){
            $uibModalInstance.dismiss('cancel');
        };

        this.back = function(){
            this.confirmModal.dismiss('back');
        };

        this.jobTypeSelected = function(){
            that.form.$setPristine();
        }

        function getAllJobTypes(){
            var promises = [];
            var allJobTypes = [];
            return tc.ijp(cartItems[0].facilityName).getJobType().then(function(jobTypeNames){
                _.each(jobTypeNames, function(jobTypeName){
                    promises.push(
                        tc.ijp(cartItems[0].facilityName).getJobType(jobTypeName).then(function (jobType){
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
                if (cartContainsDatasets) { 
                    getCartDatasetTypes().then(function(cartDatasetTypes){

                        //Filters the list of job types to only contain jobs that are compatible with all the dataset types in the cart. Do not need to check
                        //if the job type has acceptsDatasets = true because if a job has specified dataset types, it is implied it accepts datasets.
                        var compatibleJobTypes = _.filter(allJobTypes, function(jobType){
                            return _.every(cartDatasetTypes, function(cartDatasetType){
                                return _.includes(jobType.datasetTypes, cartDatasetType);
                            });
                        });

                        //If there is more than one item in the cart, only includes jobs that have multiple = true
                        //EDIT: commented out for now, might want to run a job for each item in the cart, so don't need to filter by multiple
                        //if (multipleCartItems) compatibleJobTypes = _.filter(compatibleJobTypes, function(jobType){ return stringToBoolean(jobType.multiple) });

                        //If the cart also contains datafiles, only includes jobs that have acceptsDatafiles = true
                        if (cartContainsDatafiles) compatibleJobTypes = _.filter(compatibleJobTypes, function(jobType){ return stringToBoolean(jobType.acceptsDatafiles)});

                        that.compatibleJobTypes = compatibleJobTypes;
                        that.selectedJobType = that.compatibleJobTypes[0] || "";
                        that.loadingJobTypes = false;
                        setupJobOptions();
                    });

                } else if (cartContainsDatafiles) {
                    //If the cart doesn't contain datasets, it must contain datafiles. The job type must have acceptsDatafiles = true
                    var compatibleJobTypes = _.filter(allJobTypes, function(jobType) { return stringToBoolean(jobType.acceptsDatafiles) });
                    //EDIT: commented out for now, might want to run a job for each item in the cart, so don't need to filter by multiple
                    //If there is more than one datafile in the cart, the job type must have multiple = true
                    if (multipleCartItems) compatibleJobTypes = _.filter(compatibleJobTypes, function(jobType){ return stringToBoolean(jobType.multiple) });

                    that.compatibleJobTypes = compatibleJobTypes;
                    that.selectedJobType = compatibleJobTypes[0] || "";
                    that.loadingJobTypes = false;
                    setupJobOptions();

                } else {
                    //If there is no input, show job-only jobs, where datasetTypes = []
                    var compatibleJobTypes = _.filter(allJobTypes, function(jobType) { return !(jobType.datasetTypes.length > 0) });

                    that.compatibleJobTypes = compatibleJobTypes;
                    that.selectedJobType = compatibleJobTypes[0] || "";
                    that.loadingJobTypes = false;
                    setupJobOptions();
                }

            });

        }

        function getCartDatasetTypes(){
            var cartDatasets = _.filter(cartItems, function(dataItem){
                if (dataItem.entityType === 'dataset') return true;
            });
            var cartDatasetIds = _.map(cartDatasets, 'entityId');

            var deferred = $q.defer();

            tc.icat(cartItems[0].facilityName).query("select distinct dataset.type.name from Dataset dataset where dataset.id in ('" + cartDatasetIds.join("','") + "')").then(function(datasetTypes) {
                deferred.resolve(datasetTypes);
            }, function(error){
                deferred.reject(error);
            });
            return deferred.promise;
        }

        function stringToBoolean(string) {
            switch(string){
                case "true": return true;
                default: return false;
            }
        }

        function setupJobOptions(){
            _.each(that.compatibleJobTypes, function(jobType){
                //Change structure of any 'boolean group' job options so they are more easily constructible in html
                //Find unique boolean group names
                var groupNames = _.uniq(_.filter(_.map(jobType.jobOptions, 'groupName'), undefined));
                _.each(groupNames, function(groupName){
                    //Find first option associated with that group, replace it with a single object containing all option information for that group,
                    //and remove all following objects associated with that group.
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
                            option.value = stringToBoolean(option.defaultValue) || false;
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
