

(function() {
    'use strict';

    var app = angular.module('angularApp');

    app.service('tcFacility', function($sessionStorage, helpers, tcIcat, tcIds, tcIjp, tcUser, tcAdmin, APP_CONFIG){

    	this.create = function(tc, facilityName, APP_CONFIG){
    		return new Facility(tc, facilityName);
    	};

        function Facility(tc, facilityName){
            var icat;
            var ids;
            var ijp;
            var admin;
            var user;
            
            this.config = function(){
                var out = APP_CONFIG.facilities[facilityName];
                out.facilityName = out.facilityName || facilityName;
                var sessions = $sessionStorage.sessions || {};
                var facilityId = (sessions[facilityName] || {}).facilityId;
                if(facilityId) out.facilityId = facilityId;
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
