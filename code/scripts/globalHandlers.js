/*document.body.onbeforeunload = ()=>{
    if(window.disableRefreshSafetyAlert){
        return ;
    }
    return "Are you sure? This may cause inconsistencies";
}*/

if ($$) {
    $$.refreshInProgress = false;
    $$.showErrorAlert = (text)=>{
        if(!$$.refreshInProgress){
            alert(text);
        }
    }

    $$.forceTabRefresh = ()=>{
        $$.refreshInProgress = true;
        window.top.location.reload();
    }

    $$.navigateToPage = (page)=>{
        $$.refreshInProgress = true;
        $$.history.go(page);
    }

    $$.forceRedirect = (url)=>{
        $$.refreshInProgress = true;
        window.top.location.replace(url);
    }

    $$.disableAlerts = ()=>{
        $$.refreshInProgres = true;
    }

    const originalHTTPHandler = $$.httpUnknownResponseGlobalHandler;
    $$.httpUnknownResponseGlobalHandler = function (res) {
        let err = res ? res.err : undefined;
        if (err && err.rootCause == "network") {
            originalHTTPHandler(res);
            $$.showErrorAlert("Network issues detected!");
        }
    }
}