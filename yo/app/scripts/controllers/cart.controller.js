

(function(){
    'use strict';

    var app = angular.module('angularApp');

    app.controller('CartController', function($translate, $uibModalInstance, $uibModal, $q, $timeout, $scope, $rootScope, tc, uiGridConstants, helpers){
        var that = this;
        var pagingConfig = tc.config().paging;
        var timeout = $q.defer();
        var gridApi;
        $scope.$on('$destroy', function(){ timeout.resolve(); });
        var isScroll = pagingConfig.pagingType == 'scroll';
        this.isScroll = isScroll;
        var pageSize = isScroll ? pagingConfig.scrollPageSize : pagingConfig.paginationNumberOfRows;
        var gridOptions = _.merge({data: [], appScopeProvider: this}, tc.config().cart.gridOptions);
        helpers.setupTopcatGridOptions(gridOptions, 'cart');
        gridOptions.columnDefs.push({
            name : 'actions',
            translateDisplayName: 'CART.COLUMN.ACTIONS',
            enableFiltering: false,
            enable: false,
            enableSorting: false,
            cellTemplate : '<div class="ui-grid-cell-contents"><a ng-click="grid.appScope.remove(row.entity)" translate="CART.ACTIONS.LINK.REMOVE.TEXT" class="btn btn-primary btn-xs" uib-tooltip="' + $translate.instant('CART.ACTIONS.LINK.REMOVE.TOOLTIP.TEXT') + '" tooltip-placement="left" tooltip-append-to-body="true"></a></div>'
        });
        this.gridOptions = gridOptions;
        this.totalSize = undefined;

        var promises = [$timeout(1000)];
        var cartItems = [];
        _.each(tc.userFacilities(), function(facility){
            promises.push(facility.user().cart(timeout.promise).then(function(cart){
                cartItems = _.flatten([cartItems, cart.cartItems]);
                cart.getSize(timeout.promise).then(function(size){
                    if(that.totalSize === undefined) that.totalSize = 0;
                    that.totalSize = that.totalSize + size;
                });
            }));
        });

        var page = 1;
        var pages = [];
        var pagesPromise = $q.all(promises).then(function(){
            pages = _.chunk(cartItems, pageSize);
        });

        this.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };

        this.remove = function(cartItem){
            var data = [];
            _.each(that.gridOptions.data, function(currentCartItem){
                if(currentCartItem.id != cartItem.id) data.push(currentCartItem);
            });
            that.gridOptions.data = data;
            cartItem.delete().then(function(){
                if(that.gridOptions.data.length == 0){
                    $uibModalInstance.dismiss('cancel');
                }
            });
        };

        this.removeAll = function(){
            var promises = [];
            _.each(tc.userFacilities(), function(facility){
                promises.push(facility.user().deleteAllCartItems(timeout.promise));
            });
            $q.all(promises).then(function(){
                $uibModalInstance.dismiss('cancel');
            });
        };

        this.download = function(){
            $uibModal.open({
                templateUrl : 'views/download-cart.html',
                controller: "DownloadCartController as downloadCartController",
                size : 'lg'
            })
        };

        function getPage(){
            var defered = $q.defer();
            pagesPromise.then(function(){
                var out = pages[page - 1];
                if(!out) out = [];
                _.each(out, function(cartItem){
                    cartItem.getSize(timeout.promise);
                    cartItem.getStatus(timeout.promise);
                });
                defered.resolve(out);
            });
            return defered.promise;
        }

        function updateScroll(resultCount){
            if(isScroll){
                $timeout(function(){
                    var isMore = resultCount == pageSize;
                    if(page == 1) gridApi.infiniteScroll.resetScroll(false, isMore);
                    gridApi.infiniteScroll.dataLoaded(false, isMore);
                });
            }
        }

        gridOptions.onRegisterApi = function(_gridApi) {
            gridApi = _gridApi;

            getPage().then(function(results){
                gridOptions.data = results;
                updateScroll(results.length);
            });

            //sort change callback
            gridApi.core.on.sortChanged($scope, function(grid, sortColumns){
                
            });

            //filter change calkback
            gridApi.core.on.filterChanged($scope, function() {
                
            });


            if(isScroll){
                //scroll down more data callback (append data)
                gridApi.infiniteScroll.on.needLoadMoreData($scope, function() {
                    page++;
                    getPage().then(function(results){
                        _.each(results, function(result){ gridOptions.data.push(result); });
                        if(results.length == 0) page--;
                        updateScroll(results.length);
                    });
                });

                //scoll up more data at top callback (prepend data)
                gridApi.infiniteScroll.on.needLoadMoreDataTop($scope, function() {
                    page--;
                    getPage().then(function(results){
                        _.each(results.reverse(), function(result){ gridOptions.data.unshift(result); });
                        if(results.length == 0) page++;
                        updateScroll(results.length);
                    });
                });
            } else {
                //pagination callback
                gridApi.pagination.on.paginationChanged($scope, function(_page, _pageSize) {
                    page = _page;
                    pageSize = pageSize;
                    getPage().then(function(results){
                        gridOptions.data = results;
                    });
                });
            }

        };

    });

})();
