

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
          'string': function(jobTypeName){
            var out = $q.defer();
            this.get('jobtype/' + jobTypeName).then(function(allJobTypes){
              out.resolve(allJobTypes);
            }, function(){ out.reject(); });

            return out.promise;
          },
          '': function(){
            var out = $q.defer();
            this.get('jobtype').then(function(jobTypeNameArray){
              out.resolve(jobTypeNameArray);
            }, function(){ out.reject(); });

            return out.promise;
          }
 
        });

        this.getJob = helpers.overload({
          'string': function(jobId){
            var out = $q.defer();
            this.get('status/' + jobId, {
             sessionId: facility.icat().session().sessionId
            }).then(function(job){
              out.resolve(job);
            }, function(){ out.reject(); });

            return out.promise;
          },
          '': function(){
            var out = $q.defer();
            this.get('status', {
              sessionId: facility.icat().session().sessionId
            }).then(function(allJobs){
              out.resolve(allJobs);
            }, function(){ out.reject(); });

            return out.promise;
          }
        });

        this.getJobOutput = helpers.overload({
          'string': function(jobId){
            var out = $q.defer();
            this.get('output/' + jobId, {
              sessionId: facility.icat().session().sessionId
            }).then(function(jobOutput){
              out.resolve(jobOutput);
            }, function(){ out.reject(); });

            return out.promise
          }
        });

        this.getErrorOutput = helpers.overload({
          'string': function(jobId){
            var out = $q.defer();
            this.get('error/' + jobId, {
              sessionId: facility.icat().session().sessionId
            }).then(function(jobOutput){
              out.resolve(jobOutput);
            }, function(){ out.reject(); });

            return out.promise
          }
        });

        this.submitJob = helpers.overload({
          'string': function(jobType){
            var out = $q.defer();
            this.post('submit', {
              jobName: jobType,
              sessionId: facility.icat().session().sessionId
            }).then(function(response){
              console.log(response);
            }, function(){ out.reject(); });
          },
          'string, array': function(jobType, jobParameters){
            var out = $q.defer();
            this.post('submit', {
              jobName: jobType,
              parameter: jobParameters,
              sessionId: facility.icat().session().sessionId
            }).then(function(response){
              console.log(response);
            }, function(){ out.reject(); });
          }
        });

        if (facility.config().ijpUrl == undefined) console.error('ijpUrl is undefined for facility ' + facility.config().title);
        helpers.generateRestMethods(this, facility.config().ijpUrl + '/ijp/rest/jm/');
    	}
		

	});

})();