


(function(){
    'use strict';

    var app = angular.module('angularApp');

    app.controller('ConfigureJobController', function($q, $uibModalInstance, $scope, $rootScope, $uibModalStack, tc, cartItems){

        var that = this;
        var cartEntityTypes = _.uniq(_.map(cartItems, 'entityType'));
        var cartContainsDatasets = _.includes(cartEntityTypes, 'dataset');
        var cartContainsDatafiles = _.includes(cartEntityTypes, 'datafile');
        var multipleCartItems = cartItems.length > 1;
        var cartDatasetTypes = [];
        this.loadingJobTypes = true;
        this.loadingJobOptions = true;
        this.form = {};

        getCompatibleJobTypes();

        this.submitJob = function() {

            console.log(this.form);
            that.form.$setSubmitted();

            if (that.form.$valid) {
                var jobOptions = {};
                _.each(this.selectedJobType.jobOptions, function(jobOption){ jobOptions[jobOption.name] = jobOption.value });
                    tc.ijp(cartItems[0].facilityName).submitJob(this.selectedJobType.name, _.map(cartItems, 'entityId'), jobOptions);
            }
        };

        this.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };

        this.jobTypeSelected = function() {
            that.loadingJobOptions = true;
            setupJobOptions();
            that.loadingJobOptions = false;
        }

        function getAllJobTypes(){
            var deferred =  $q.defer();
            tc.ijp(cartItems[0].facilityName).getJobType().then(function(allJobTypes){
                that.jobTypes = allJobTypes;
                deferred.resolve(allJobTypes);
            }, function(error){
                deferred.reject(error);
            });
            return deferred.promise;
        }

        function getCompatibleJobTypes(){

            getAllJobTypes().then(function(allJobTypes){

                if (cartContainsDatasets) { 
                    getCartDatasetTypes().then(function(cartDatasetTypes){

                        console.log('cartDatasetTypes: ' + JSON.stringify(cartDatasetTypes));

                        //Filters the list of job types to only contain jobs that are compatible with all the dataset types in the cart. Do not need to check
                        //if the job type has acceptsDatasets = true because if a job has specified dataset types, it is implied it accepts datasets.
                        var compatibleJobTypes = _.filter(allJobTypes, function(jobType){
                            return _.every(cartDatasetTypes, function(cartDatasetType){
                                return _.includes(jobType.datasetTypes, cartDatasetType);
                            });
                        });
                        console.log('compatibleJobTypes: ' + JSON.stringify(compatibleJobTypes));

                        //If there is more than one item in the cart, only includes jobs that have multiple = true
                        if (multipleCartItems) compatibleJobTypes = _.filter(compatibleJobTypes, function(jobType){ return stringToBoolean(jobType.multiple) });
                        console.log('compatibleJobTypes (after multiple): ' + JSON.stringify(compatibleJobTypes));
                        //If the cart also contains datafiles, only includes jobs that have acceptsDatafiles = true
                        if (cartContainsDatafiles) compatibleJobTypes = _.filter(compatibleJobTypes, function(jobType){ return stringToBoolean(jobType.acceptsDatafiles)});
                        console.log('compatibleJobTypes (after acceptsDatafiles): ' + JSON.stringify(compatibleJobTypes));

                        that.compatibleJobTypes = compatibleJobTypes;
                        that.selectedJobType = that.compatibleJobTypes[0] || "";
                        that.loadingJobTypes = false;
                        setupJobOptions();
                        that.loadingJobOptions = false;
                    });

                } else {
                    //If the cart doesn't contain datasets, it must contain datafiles. The job type must have acceptsDatafiles = true
                    var compatibleJobTypes = _.filter(allJobTypes, function(jobType) { return stringToBoolean(jobType.acceptsDatafiles) });
                    console.log('compatibleJobTypes (after acceptsDatafiles): ' + JSON.stringify(compatibleJobTypes));
                    //If there is more than one datafile in the cart, the job type must have multiple = true
                    if (multipleCartItems) compatibleJobTypes = _.filter(compatibleJobTypes, function(jobType){ return stringToBoolean(jobType.multiple) });
                    console.log('compatibleJobTypes (after multiple): ' + JSON.stringify(compatibleJobTypes));

                    that.compatibleJobTypes = compatibleJobTypes;
                    that.selectedJobType = compatibleJobTypes[0] || "";
                    that.loadingJobTypes = false;
                    setupJobOptions();
                    that.loadingJobOptions = false;
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

            _.each(that.selectedJobType.jobOptions, function(option){

                //Set up default values
                switch (option.type) {
                    case "boolean":
                        option.value = stringToBoolean(option.defaultValue) || false;
                        break;
                    case "integer":
                    case "float":
                        option.value = parseFloat(option.defaultValue) || "";
                        break;
                    case "string":
                        option.value = option.defaultValue || "";
                        break;
                    case "enumeration":
                        option.value = option.defaultValue || option.values[0];
                } 
            });
        }

    });

})();
