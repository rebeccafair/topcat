

(function() {
    'use strict';

    var app = angular.module('angularApp');

    app.service('tcFacility', function($sessionStorage, helpers, tcIcat, tcIds, tcIjp, tcUser, tcAdmin, APP_CONFIG){

    	this.create = function(tc, name, APP_CONFIG){
    		return new Facility(tc, name);
    	};

        function Facility(tc, name){
            var icat;
            var ids;
            var ijp;
            var admin;
            var user;
            
            this.config = function(){
                var out = _.select(APP_CONFIG.facilities, function(facility){ return name == facility.name; })[0];
                var sessions = $sessionStorage.sessions || {};
                var id = (sessions[name] || {}).facilityId;
                if(id) out.id = id;
                return out; 
            }

            this.tc = function(){
                return tc;
            };

            this.icat = function(){
                if(!icat) icat = tcIcat.create(this);
                return icat;
            };

            this.ids = function(){
                if(!ids) ids = tcIds.create(this);
                return ids;
            };

            this.ijp = function(){
                if(!ijp) ijp = tcIjp.create(this);
                return ijp;
            };

            this.admin = function(){
                if(!admin) admin = tcAdmin.create(this);
                return admin;
            }

            this.user = function(){
                if(!user) user = tcUser.create(this);
                return user;
            }

        }

	});

})();
