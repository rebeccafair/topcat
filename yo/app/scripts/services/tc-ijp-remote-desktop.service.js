

(function() {
    'use strict';

    var app = angular.module('angularApp');

    app.service('tcIjpRemoteDesktop', function($q, helpers){

    	this.create = function(ijp){
    		return new IjpRemoteDesktop(ijp);
    	};

    	function IjpRemoteDesktop(ijp){
        var that = this;
        var facility = ijp.facility();

        this.openSession = function(sessionDetails){
          var out = $q.defer();
          this.get('/rdp', {
            accountName: sessionDetails.username,
            password: sessionDetails.password,
            hostName: sessionDetails.host
          }).then(function(response){
            out.resolve(response);
          }, function(){ out.reject(); });
          return out.promise;
        };

        if (facility.config().ijpUrl == undefined) console.error('ijpUrl is undefined for facility ' + facility.config().title);
        helpers.generateRestMethods(this, facility.config().ijpUrl);

    	}

	});

})();