//I know this code is trash but I'm just using this as a place to dump where I find the stuff that I'm working on.

var doStuff = function() {

$.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=853313").done(response => {
     var title = response.getElementsByTagName("Name")[0];
     $("#someElement").append(title);
    });
}



window.onload = doStuff();
