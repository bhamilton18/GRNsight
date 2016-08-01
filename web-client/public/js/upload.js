$(function () {
  var currentNetwork = null;

  // Style of the tooltips when the user mouses over the label names
  $(".info").tooltip({
    placement: "top",
    delay: { show: 700, hide: 100 }
  });

  // Defaults the sliders so that they return to their default values when the page is refreshed
  $( "#linkDistInput" ).val(500);
  $( "#chargeInput" ).val(-1000);
  $( "#chargeDistInput" ).val(1000);
  $( "#gravityInput" ).val(0.1);

  var displayNetwork = function (network, name) {
    currentNetwork = network;
    console.log(network); // Display the network in the console
    $("#graph-metadata").html(network.genes.length + " nodes<br>" + network.links.length + " edges");

    if (network.warnings.length > 0) {
      displayWarnings(network.warnings);
    }

    $("#fileName").text(name); // Set the name of the file to display in the top bar
    $("input[type='range']").off("input"); // I have no idea why I do this. Investigate later.

    // If more things need to be turned off, we'll add them to this array
    [ "#resetSliders", "#resetSlidersMenu", "#undoReset", "#undoResetMenu" ].forEach(function (selector) {
      $(selector).off("click");
    });

    drawGraph(network.genes, network.links, network.positiveWeights, network.negativeWeights, {
      linkSlider: "#linkDistInput",
      chargeSlider: "#chargeInput",
      chargeDistSlider: "#chargeDistInput",
      gravitySlider: "#gravityInput",
      resetSliderButton: "#resetSliders",
      resetSliderMenu: "#resetSlidersMenu",
      undoResetButton: "#undoReset",
      undoResetMenu: "#undoResetMenu"
    }, network.sheetType, network.warnings);
  };

  var annotateLinks = function (network) {
    // TODO This duplicates logic that is done on the server side for an .xlsx spreadsheet.
    //      Think of a way to consolidate it. Having discovered this, it seems like this should
    //      be done on the client side because it rearranges data redundantly, for ease of display.
    network.positiveWeights = [];
    network.negativeWeights = [];

    network.links.forEach(function (link) {
      if (network.sheetType === "unweighted" && !link.value) {
        link.value = 1;
      }

      if (link.value > 0) {
        link.type = "arrowhead";
        link.stroke = "MediumVioletRed";
        network.positiveWeights.push(link.value);
      } else {
        link.type = "repressor";
        link.stroke = "DarkTurquoise";
        network.negativeWeights.push(link.value);
      }
    });
  };

  /*
   * Thanks to http://stackoverflow.com/questions/6974684/how-to-send-formdata-objects-with-ajax-requests-in-jquery
   * for helping to resolve this.
   */
  var loadGrn = function (url, name, formData) {
    // The presence of formData is taken to indicate a POST.
    var fullUrl = $("#service-root").val() + url;
    (formData ?
      $.ajax({
        url: fullUrl,
        data: formData,
        processData: false,
        contentType: false,
        type: "POST",
        crossDomain: true
      }) :
      $.getJSON(fullUrl)
    ).done(function (network) {
      displayNetwork(network, name);
      previousFile = [url, name, formData]; // Store info about the previous file for use in reload
    }).error(function (xhr, status, error) {
      var err = JSON.parse(xhr.responseText);
      var errorString = "Your graph failed to load.<br><br>";

      $("#upload").val(""); // De-select the bad file.
      if (!err.errors) { // will be falsy if an error was thrown before the network was generated
        errorString += err;
      } else {
        errorString = err.errors.reduce(function (currentErrorString, currentError) {
          return currentErrorString + currentError.possibleCause + " " + currentError.suggestedFix + "<br><br>";
        }, errorString);
      }

      $("#error").html(errorString);
      $("#errorModal").modal("show");
    });
  };

  var submittedFilename = function ($upload) {
    var path = $upload.val();
    var fakePathCheck = path.search("\\\\") + 1;

    while (fakePathCheck) {
      path = path.substring(fakePathCheck);
      fakePathCheck = path.search("\\\\") + 1;
    }

    return path;
  };

  $("#upload").on("change", function (event) {
    var $upload = $(this);
    var filename = submittedFilename($upload);

    reload = ["", ""];

    var formData = new FormData();
    formData.append("file", $upload[0].files[0]);
    loadGrn("/upload", filename, formData);

    if (window.ga) {
      window.ga("send", "pageview", {
        page: "/GRNsight/upload",
        sessionControl: "start"
      });
    }

    event.preventDefault();
  });

  $("#upload-sif").on("change", function (event) {
    var $upload = $(this);
    var filename = submittedFilename($upload);
    var formData = new FormData();
    formData.append("file", $upload[0].files[0]);

    var fullUrl = $("#service-root").val() + "/upload-sif";
    $.ajax({
      url: fullUrl,
      data: formData,
      processData: false,
      contentType: false,
      type: "POST",
      crossDomain: true
    }).done(function (network) {
      annotateLinks(network);
      displayNetwork(network, filename);
    }).error(function (xhr, status, error) {
      $("#importErrorMessage").text(xhr.responseText);
      $("#importErrorModal").modal("show");
    });

    event.preventDefault();
  });

  var displayWarnings = function (warnings) {
    $("#warningIntro").html("There were " + warnings.length + " warning(s) detected in this file. " + 
      "It is possible that these warnings are the result of extraneous data outside of the matrix, but " + 
      "we recommend you review your file and ensure that everything looks correct. The graph will be loaded, " +
      "but may not look the way it is expected to look. To view the details " + 
      "of the warning(s), please select the dropdown below.");

    $("#warningsList").html(warnings.reduce(function (currentWarningString, currentWarning) {
      return currentWarningString + currentWarning.errorDescription + "<br><br>";
    }, ""));

    $("#warningsModal").modal("show");
  }

  $("#warningsModal").on("hidden.bs.modal", function () {
    if ($("#warningsInfo").hasClass("in")) {
      $("#warningsInfo").removeClass("in");
    }
  });

  var previousFile = ["/upload", "", undefined];
  $("#reload").click(function (event) {
    if(!$(".startDisabled").hasClass("disabled")) { 
      if(reload[0] === "") {
        loadGrn(previousFile[0], previousFile[1], previousFile[2]);
      } else {
        loadGrn(reload[0], reload[1]);
      }
    }
  });

  var reload = ["", ""];
  $("#unweighted").click(function (event) {
    loadDemo("/demo/unweighted", "Demo #1: Unweighted GRN (21 genes, 50 edges)");
  });

  $("#weighted").click(function (event) {
    loadDemo("/demo/weighted", "Demo #2: Weighted GRN (21 genes, 50 edges, Dahlquist Lab unpublished data)");
  });

  $("#schadeInput").click(function (event) {
    loadDemo("/demo/schadeInput", "Demo #3: Unweighted GRN (21 genes, 31 edges)");
  });

  $("#schadeOutput").click(function (event) {
    loadDemo("/demo/schadeOutput", "Demo #4: Weighted GRN (21 genes, 31 edges, Schade et al. 2004 data)");
  });

  var loadDemo = function(url, name) {
    loadGrn(url, name);
    reload = [url, name];
    $("#upload").val("");
  };

  $(".deselectedColoring").click(function (event) {
    colorPreferences(event);
  });

  var colorPreferences = function(event) {
    var deselectedID = "#" + $(".deselectedColoring").attr("id");
    var selectedID = "#" + $(".selectedColoring").attr("id");
    $(deselectedID + ">span").attr("class", "glyphicon glyphicon-ok");
    $(selectedID + ">span").attr("class", "glyphicon invisible");
    // Allows the click handler to swap between the two different options
    $(deselectedID).attr("class", "selectedColoring")
                   .off("click");
    $(selectedID).attr("class", "deselectedColoring")
                 .on("click", colorPreferences);
  };

  // Allow the sliders to be used before loading a graph

  $("input[type='range']").on("input", function() {
    // Due to all of the sliders and their HTML values sharing the same naming convention: NameInput/NameVal, 
    // we can remove the Input and replace it with Val to change the correct HTML value each time.
    var selectedSlider = $(this).attr("id").search("Input");
    var targetID = $(this).attr("id").substring(0, selectedSlider) + "Val";
    var gravityCheck = "";
    if(targetID === "gravityVal"  && $(this).val().length === 3) {
      gravityCheck = "0";
    }
    $("#" + targetID).html($(this).val() + gravityCheck);
  });

  // Handler is unbound first to prevent it from firing twice. 
  // addHanders[0][i] = ID; addHandlers[1][i] = function run when that ID is clicked
  var addHandlers = [ 
    [ "#lockSliders", "#lockSlidersMenu", "#resetSliders", "#resetSlidersMenu", "#undoReset", "#undoResetMenu" ],
    [ lockSliders, lockSliders, resetSliders, resetSliders, undoReset, undoReset]
  ]
  for(var i = 0; i < addHandlers[0].length; i++) {
    $(addHandlers[0][i]).unbind("click").click(addHandlers[1][i]);
  };

  function lockSliders(event) {
    if( $("#lockSlidersMenu").attr("class") === "noGlyph" ) {
      $("#lockSliders").prop("checked", true);
      $("#lockSlidersMenu").removeClass("noGlyph")
                             .html("<span class='glyphicon glyphicon-ok'></span>&nbsp; Lock Force Graph Parameters");
    } else {
      $("#lockSliders").prop("checked", false);
      $("#lockSlidersMenu").addClass("noGlyph")
                           .html("<span class='glyphicon invisible'></span>&nbsp; Lock Force Graph Parameters");
    }
    var check = $("#lockSliders").prop("checked");
    $("input[type='range']").prop("disabled", check);
    $("#resetSliders").prop("disabled", check);
  };
  
  // Enter the prefix of each slider here
  var inputs = [ "#linkDist", "#charge", "#chargeDist", "#gravity" ],
      defaultValues = [500, -1000, 1000, 0.1],
      newValues = [0, 0, 0, 0];

  function resetSliders(event) {
    var check = $( "#lockSliders" ).prop( "checked" );
    if( !check ) {
      newValues = [ $("#linkDistInput").val(), $("#chargeInput").val(), $("#chargeDistInput").val(), $("#gravityInput").val() ];
      for(var i = 0; i < inputs.length; i++) {
        $(inputs[i] + "Input").val(defaultValues[i]);
        if(inputs[i] != "#gravity") {
          $(inputs[i] + "Val").html(defaultValues[i]);
        } else {
          $(inputs[i] + "Val").html(defaultValues[i] + "0"); // add 0 to the end of gravity so that it reads 0.10
        }
      }
      $( "#undoReset" ).prop( "disabled", false );
    }
  };

  function undoReset(event) {
    var check =  $( "#undoReset" ).prop( "disabled" );
    if( !check ) {
      for(var i = 0; i < inputs.length; i++) {
        $(inputs[i] + "Input").val(newValues[i]);
        if(inputs[i] != "#gravity") {
          $(inputs[i] + "Val").html(newValues[i]);
        } else {
          var gravityCheck = ""; 
          if( $("#gravityInput").val().length === 3 ) {
            gravityCheck = "0";
          }
          $(inputs[i] + "Val").html(newValues[i] + gravityCheck); // add 0 to the end of gravity so that it reads 0.10
        }
      }
      $( "#undoReset" ).prop( "disabled", true );
    }
  }
  
  $("#printGraph").click(function (event) {
    if(!$(".startDisabled").hasClass("disabled")) {
      window.print();
    }
  });

  var flattenNetwork = function (network) {
    var result = $.extend(true, { }, network);
    result.links.forEach(function (link) {
      link.source = link.source.index;
      link.target = link.target.index;
    });
    return result;
  };

  var filenameWithExtension = function (extension) {
    var filename = $("#fileName").text();
    var dotSegments = filename.split(".");
    if (dotSegments[0] !== filename) {
      dotSegments.pop();
      dotSegments.push(extension);
      filename = dotSegments.join(".");
    } else {
      filename += "." + extension;
    }

    return filename;
  };

  var performExport = function (route, extension) {
    return function (event) {
      if (!$(".startDisabled").hasClass("disabled")) {
        var networkToExport = flattenNetwork(currentNetwork);
        var exportForm = $("<form></form>").attr({
          method: "POST",
          action: $("#service-root").val() + "/" + route
        }).append($("<input></input>").attr({
          type: "hidden",
          name: "filename",
          value: filenameWithExtension(extension)
        })).append($("<input></input>").attr({
          type: "hidden",
          name: "network",
          value: JSON.stringify(networkToExport)
        }));
        $("body").append(exportForm);
        exportForm.submit();
        exportForm.remove();
      }
    };
  };

  $("#exportAsSif").click(performExport("export-to-sif", "sif"));
  $("#exportAsGraphMl").click(performExport("export-to-graphml", "graphml"));
});
