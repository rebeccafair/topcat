

(function() {
    'use strict';

    var app = angular.module('angularApp');

    app.service('tcIjp', function($q, helpers, tcCache){

    	this.create = function(facility){
    		return new Ijp(facility);
    	};

    	function Ijp(facility){
        var that = this;
        var cache;

        this.cache = function(){
          if(!cache) cache = tcCache.create('ijp:' + facility.config().facilityName);
          return cache;
        };

    		this.version = function(){
    			var out = $q.defer();
    			this.get('version').then(function(data){
    				out.resolve(data.version);
    			}, function(){ out.reject(); });
    			return out.promise;
    		};

        this.getJobType = helpers.overload({
          'array': function(jobTypeNamesArray){
            var out = $q.defer();
            this.get('jobtype', {
              jobTypes: jobTypeNamesArray
            }).then(function(jobTypeArray){
              out.resolve(jobTypeArray);
            }, function(){ out.reject(); });

            return out.promise;
          },
          'string': function(jobTypeName){
            return this.getJobType([jobTypeName]);
          },
          '': function(){
            var out = $q.defer();
            this.get('jobtypes').then(function(allJobTypes){
              out.resolve(allJobTypes);
            }, function(){ out.reject(); });

            return out.promise;
          }
 
        });

        this.getJob = helpers.overload({
          'array': function(jobIdArray){
            var out = $q.defer();
            this.get('job', {
              jobIds: jobIdArray
            }).then(function(jobArray){
              out.resolve(jobArray);
            }, function(){ out.reject(); });

            return out.promise;
          },
          'string': function(jobId){
            return this.getJob([jobId]);
          },
          '': function(){
            var out = $q.defer();
            this.get('jobs').then(function(allJobs){
              out.resolve(allJobs);
            }, function(){ out.reject(); });

            return out.promise;
          }
 
        });

    		helpers.generateRestMethods(this, facility.config().ijpUrl + 'ijp/');
    	}
		

	});

})();