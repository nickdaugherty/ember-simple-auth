'use strict';

/**
  The main namespace for Ember.SimpleAuth

  @class SimpleAuth
  @namespace Ember
  @static
**/
Ember.SimpleAuth = {};

/**
  Sets up Ember.SimpleAuth for your application; invoke this method in a custom
  initializer like this:

  ```javascript
  Ember.Application.initializer({
    name: 'authentication',
    initialize: function(container, application) {
      Ember.SimpleAuth.setup(container, application);
    }
  });
  ```

  @method setup
  @static
  @param {Container} container The Ember.js container, see http://git.io/ed4U7Q
  @param {Ember.Application} application The Ember.js application instance
  @param {Object} [options]
    @param {String} [options.routeAfterLogin] route to redirect the user to after successfully logging in - defaults to `'index'`
    @param {String} [options.routeAfterLogout] route to redirect the user to after logging out - defaults to `'index'`
    @param {String} [options.loginRoute] route to redirect the user to when login is required - defaults to `'login'`
    @param {String} [options.serverTokenRoute] the server endpoint used to obtain the access token - defaults to `'/token'`
    @param {String} [options.autoRefreshToken] enable/disable automatic token refreshing (if the server supports it) - defaults to `true`
    @param {Array[String]} [options.crossOriginWhitelist] list of origins that (besides the origin of the Ember.js application) send the authentication token to - defaults to `[]`
**/
Ember.SimpleAuth.setup = function(container, application, options) {
  options = options || {};
  this.routeAfterLogin      = options.routeAfterLogin || 'index';
  this.routeAfterLogout     = options.routeAfterLogout || 'index';
  this.loginRoute           = options.loginRoute || 'login';
  this.serverTokenEndpoint  = options.serverTokenEndpoint || '/token';
  this.autoRefreshToken     = Ember.isEmpty(options.autoRefreshToken) ? true : !!options.autoRefreshToken;
  this.crossOriginWhitelist = Ember.A(options.crossOriginWhitelist || []);

  var session = Ember.SimpleAuth.Session.create();
  application.register('simple_auth:session', session, { instantiate: false, singleton: true });
  Ember.$.each(['model', 'controller', 'view', 'route'], function(i, component) {
    application.inject(component, 'session', 'simple_auth:session');
  });

  Ember.$.ajaxPrefilter(function(options, originalOptions, jqXHR) {
    if (!Ember.isEmpty(session.get('authToken')) && Ember.SimpleAuth.includeAuthorizationHeader(options.url)) {
      jqXHR.setRequestHeader('Authorization', 'Bearer ' + session.get('authToken'));
    }
  });

  /**
    @method includeAuthorizationHeader
    @private
  */
  this.includeAuthorizationHeader = function(url) {
    this._links = this._links || {};
    var link = Ember.SimpleAuth._links[url] || function() {
      var link = document.createElement('a');
      link.href = url;
      Ember.SimpleAuth._links[url] = link;
      return link;
    }();
    function formatLocation(location) { return location.protocol + '//' + location.hostname + (location.port !== '' ? ':' + location.port : ''); }
    var linkOrigin       = formatLocation(link);
    this._locationOrigin = formatLocation(window.location);
    return this.crossOriginWhitelist.indexOf(linkOrigin) > -1 || linkOrigin === this._locationOrigin;
  },

  /**
    Call this method when an external login was successful. Typically you would
    have a separate window in which the user is being presented with the
    external provider's authentication UI and eventually being redirected back
    to your application. When that redirect occured, the application needs to
    call this method on its opener window, e.g.:

    ```html
      <html>
        <head></head>
        <body>
          <script>
            window.opener.Ember.SimpleAuth.externalLoginSucceeded({ access_token: 'secret token!' });
            window.close();
          </script>
        </body>
      </html>
    ```

    This method will then set up the session (see
    [Session#setup](#Ember.SimpleAuth.Session_setup) and invoke the
    [Ember.SimpleAuth.ApplicationRouteMixin#loginSucceeded](#Ember.SimpleAuth.ApplicationRouteMixin_loginSucceeded)
    callback.

    @method externalLoginSucceeded
    @param {Object} sessionData The data to setup the session with (see [Session#setup](#Ember.SimpleAuth.Session_setup)))
  */
  this.externalLoginSucceeded = function(sessionData) {
    session.setup(sessionData);
    container.lookup('route:application').send('loginSucceeded');
  };

  /**
    Call this method when an external login fails, e.g.:

    ```html
      <html>
        <head></head>
        <body>
          <script>
            window.opener.Ember.SimpleAuth.externalLoginFailed('something went wrong!');
            window.close();
          </script>
        </body>
      </html>
    ```

    The argument you pass here will be forwarded to the
    [Ember.SimpleAuth.ApplicationRouteMixin#loginSucceeded](#Ember.SimpleAuth.ApplicationRouteMixin_loginFailed)
    callback.

    @method externalLoginFailed
    @param {Object} error Any optional error that will be forwarded to the [Ember.SimpleAuth.ApplicationRouteMixin#loginSucceeded](#Ember.SimpleAuth.ApplicationRouteMixin_loginFailed) callback
  */
  this.externalLoginFailed = function(error) {
    container.lookup('route:application').send('loginFailed', error);
  };
};
