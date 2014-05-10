var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-33859566-3']);
_gaq.push(['_trackPageview']);

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
    }
});

function addEventForAnalytics(category, action, opt_label, opt_value) {
	_gaq.push(['_trackEvent', category, action, opt_label, opt_value]);
}

function updateBadge(text) {
	chrome.browserAction.setBadgeText({text: text});
	chrome.browserAction.setBadgeBackgroundColor({color: "#49C9AF"});
}