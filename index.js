#!/usr/bin/env node

var fs = require('fs'),
  path = require('path'),
  css = require('css'),
  cheerio = require('cheerio'),
  stylesheet = require('./lib/stylesheet'),
  selectorMatching = require('./lib/selector-matching'),
  cssSpecificity = require('./lib/css-specificity')
;

var file = process.argv[2],
  outputDir = process.argv[3],
  $ = cheerio.load(fs.readFileSync(file))
;

stylesheets = stylesheet.parse($('link'), path.dirname(file));
selectorMatching.generateHashtable(stylesheets);

// Algorithm Matched Selector
var annotatedRules = [],
  selectableDOM = [],
  id = 1,
  stack = [$('body')[0]]
;
while (stack.length > 0) {
  var node = stack.pop(),
    children = [],
    matchedRules
  ;
  node.id = id;
  id++;

  if (node.children !== undefined) {
    node.children.forEach(function(child) {
      if (child.type == 'tag') {
        children.push(child);
      }
    });
    stack = stack.concat(children);
  }

  matchedRules = selectorMatching.getRules(node, $);
  if (matchedRules.length > 0) {
    selectableDOM.push(node);
    matchedRules.forEach(function(rule) {
      // if the rule doesn't exist, then push it to annotatedRules
      var duplicate = annotatedRules.filter(function(annotatedRule) {
        if (annotatedRule.orderPosition == rule.orderPosition) {
          return true;
        }

        return false;
      })

      if (duplicate.length == 0) {
        var nodes = [],
          selector = rule.selector,
          tokenizedSelectors = selector.split(/:+(?=\w+|-)(?!not)/)
        ;

        // testing selector without pseudo-class
        selector = tokenizedSelectors.length > 1 ? tokenizedSelectors[0] : selector;
        $(selector).each(function(key, element) {
          nodes.push(element);
        });
        
        annotatedRules.push({
          selector: rule.selector,
          declarations: rule.declarations,
          orderPosition: rule.orderPosition,
          media: rule.media,
          matched: true,
          matchedNodes: nodes
        });
      }
    });
  }
}
//console.log(annotatedRules);

// Algorithm Effective Selector
selectableDOM.forEach(function(dom, index) {
  var getMatchingRules = function(dom) {
    var matchedRules = [];

    annotatedRules.forEach(function(rule) {
      rule.matchedNodes.forEach(function(node) {
        if (node.id == dom.id) {
          matchedRules.push(rule);
        }
      });
    });

    return matchedRules;
  };

  var rules, orderedRules;
  
  rules = getMatchingRules(dom);
  orderedRules = cssSpecificity.order(rules);

  for (var i = 0; i < orderedRules.length; i++) {
    var rule = orderedRules[i],
      selector = rule.selector,
      declarations = rule.declarations
    ;

    for (var j = 0; j < declarations.length; j++) {
      var declaration = declarations[j];
      declaration.status = declaration.status || {};

      if (declaration.type == 'declaration' && declaration.status[index] === undefined) {
        declaration.status[index] = 'effective';
      }

      // selector with pseudo-class is impossible to override another property
      tokenizedSelectors = selector.split(/:+(?=\w+|-)(?!not)/)
      if (tokenizedSelectors.length === 1) {
        for (var k = i + 1; k < orderedRules.length; k++) {
          var nextRule = orderedRules[k];

          for (var l = 0; l < nextRule.declarations.length; l++) {
            var nextDeclaration = nextRule.declarations[l];
            nextDeclaration.status = nextDeclaration.status || {};

            if (nextDeclaration.type == 'declaration' && nextDeclaration.property == declaration.property && nextRule.media == rule.media) {
              nextDeclaration.status[index] = 'overridden';
            }
          }
        }
      }
    }
  }
});

// Wheter a property is overridden or not
var isOverridden = function(declaration) {
  for (index in declaration.status) {
    if (declaration.status[index] == 'effective') {
      return false;
    }
  }

  return true;
}

// Find unused rules
var findUnusedRules = function(annotatedRules) {
  var unusedRules = [],
    orderPosition = 1
  ;
  stylesheets.forEach(function(stylesheet) {
    var rules = stylesheet.stylesheet.rules,
      checkRule = function(rule) {
        var selectors = rule.selectors,
          declarations = rule.declarations
        ;

        selectors.forEach(function(selector) {
          var isUsed = false;

          annotatedRules.forEach(function(annotatedRule) {
            if (annotatedRule.orderPosition == orderPosition) {
              isUsed = true;
            }
          });

          if (!isUsed) {
            unusedRules.push(rule);
          }

          orderPosition++;
        });
      }
    ;

    rules.forEach(function(rule) {
      if (rule.type == 'media') {
        var media = rule.media;

        rule.rules.forEach(function(mediaRule) {
          checkRule(mediaRule);
        });
      } else if (rule.type == 'rule') {
        checkRule(rule);
      }
    });
  });

  return unusedRules;
};
//var unusedRules = findUnusedRules(annotatedRules);
//console.log(unusedRules);

// Print out the optimized css
var rules = [], mediaRules = {};
annotatedRules.forEach(function(annotatedRule) {
  var declarations;

  declarations = annotatedRule.declarations.filter(function(declaration) {
    return !isOverridden(declaration);
  });
  if (declarations.length > 0) {
    rule = {
      type: 'rule',
      selectors: [annotatedRule.selector],
      declarations: declarations
    };
    if (annotatedRule.media == '') {
      rules.push(rule);
    } else {
      mediaRules[annotatedRule.media] = mediaRules[annotatedRule.media] || [];
      mediaRules[annotatedRule.media].push(rule);
    }
  }
});
var ast = {
  type: 'stylesheet',
  stylesheet: {
    rules: rules
  }
};
for (media in mediaRules) {
  ast.stylesheet.rules.push({
    type: 'media',
    media: media,
    rules: mediaRules[media]
  });
}
//fs.writeFile("./optimized.css", css.stringify(ast));
fs.writeFile(outputDir + "/optimized.css", css.stringify(ast, {compress: true}));

// buang semua css dan load optimized.css
$('link').each(function() {
  var filename;

  if (this.type == 'tag' && this.attribs.href != '') {
    if (this.attribs.rel == 'stylesheet' || this.attribs.type == 'text/css') {
      $(this).remove();
    }
  }
});
$('head').append('<link rel="stylesheet" type="text/css" href="optimized.css" />');
fs.writeFile(file, $.html());
