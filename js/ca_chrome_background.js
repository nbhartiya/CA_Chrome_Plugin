var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-33859566-3']);
_gaq.push(['_trackPageview']);

(function(e,b){if(!b.__SV){var a,f,i,g;window.mixpanel=b;a=e.createElement("script");a.type="text/javascript";a.async=!0;a.src='https://cdn.mxpnl.com/libs/mixpanel-2.2.min.js';f=e.getElementsByTagName("script")[0];f.parentNode.insertBefore(a,f);b._i=[];b.init=function(a,e,d){function f(b,h){var a=h.split(".");2==a.length&&(b=b[a[0]],h=a[1]);b[h]=function(){b.push([h].concat(Array.prototype.slice.call(arguments,0)))}}var c=b;"undefined"!==
typeof d?c=b[d]=[]:d="mixpanel";c.people=c.people||[];c.toString=function(b){var a="mixpanel";"mixpanel"!==d&&(a+="."+d);b||(a+=" (stub)");return a};c.people.toString=function(){return c.toString(1)+".people (stub)"};i="disable track track_pageview track_links track_forms register register_once alias unregister identify name_tag set_config people.set people.increment people.append people.track_charge people.clear_charges people.delete_user".split(" ");for(g=0;g<i.length;g++)f(c,i[g]);b._i.push([a,
e,d])};b.__SV=1.2}})(document,window.mixpanel||[]);
mixpanel.init("84d7acdf35579211823e3261fd207e09", {}, "ca_ce");
mixpanel.ca_ce.register({"version":chrome.app.getDetails().version, "plugin":true, "jellyCount":0});
//Code to try to add people properties to a user, but perhaps we need their email first?
//var distinct_id = mixpanel.ca_ce.get_distinct_id);
//mixpanel.ca_ce.identify(distinct_id)
//mixpanel.ca_ce.people.set({"version":chrome.app.getDetails().version, "plugin":true, "jellyCount":0});

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  // ga.src = 'https://ssl.google-analytics.com/ga.js';
  ga.src = 'https://stats.g.doubleclick.net/dc.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.method == "addEventForAnalytics") {
    	addEventForAnalytics(request.category, request.action, request.opt_label, request.opt_value);
    } else if(request.method == 'setBadge') {
    	updateBadge(request.text);
    } else if(request.method == 'openTabWithUrl') {
    	chrome.tabs.create({url: request.url});
    } else if (request.method == "addDataForMixpanel") {
	addDataForMixpanel(request.action, request.name, request.properties);
    }
});

chrome.runtime.onInstalled.addListener(function() {
  mixpanel.ca_ce.register({"Installed":Date()});
});

//when chrome appication is started after being installed
//chrome.runtime.onStartup.addListener(function() {
//  mixpanel.ca_ce.register({"Started":Date()});
//});

function addEventForAnalytics(category, action, opt_label, opt_value) {
	_gaq.push(['_trackEvent', category, action, opt_label, opt_value]);
}

function addDataForMixpanel(action, name, properties){
	if(action=="track"){
	  mixpanel.ca_ce.track(name, properties);
	} else if(action=="register"){
    mixpanel.ca_ce.register(properties)
  } else if(action=="people"){
    //not sure this can be done w/o email...will come back to later
    //mixpanel.ca_ce.identify(distinct_id);
    //mixpanel.ca_ce.people.set(properties);
  } else if(action=="alias"){
    mixpanel.ca_ce.alias(name);
  }
}

function updateBadge(text) {
	chrome.browserAction.setBadgeText({text: text});
	chrome.browserAction.setBadgeBackgroundColor({color: "#49C9AF"});
}