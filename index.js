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
  stack = [$('body')[0], $('html')[0]]
;
while (stack.length > 0) {
  var node = stack.pop(),
    matchedRules
  ;
  if (node === undefined) continue;

  node.id = id;
  id++;

  if (node.children !== undefined && node.name != 'html') {
    node.children.forEach(function(child) {
      if (child.type == 'tag' && child.name !== 'link' && child.name !== 'script') {
        stack.push(child);
      }
    });
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
          subSelector = selector.replace(/[^\\]:+(?!not\(.*\))[\w-\(\)\d\+]+/g, function(match) { return match.substring(0, 1); })
        ;

        if (subSelector.indexOf(':') === -1) {
          $(subSelector).each(function(key, element) {
            nodes.push(element);
          });
        }
        
        annotatedRules.push({
          selector: rule.selector,
          declarations: rule.declarations,
          orderPosition: rule.orderPosition,
          media: rule.media,
          matched: true,
          matchedNodes: nodes,
          source: rule.source
        });
      }
    });
  }
}
annotatedRules.sort(function(a, b) {
  if (a.orderPosition < b.orderPosition) return -1;
  if (a.orderPosition > b.orderPosition) return 1;

  return 0;
});
//console.log(annotatedRules);

var isPropertyImportant = function(property) {
  if (/\!important/.test(property)) {
    return true;
  }

  return false;
};

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
              if (isPropertyImportant(declaration.value) || !isPropertyImportant(nextDeclaration.value)) {
                nextDeclaration.status[index] = 'overridden';
              }
            }
          }
        }
      }
    }
  }
});

// Wheter a property is overridden or not
var isOverridden = function(declaration) {
  if (declaration.status === undefined) return false;

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
var rules = [], mediaRules = [], lastMedia = undefined;
var ast = {
  type: 'stylesheet',
  stylesheet: {
    rules: []
  }
};
var clone = function(obj) {
  if (null == obj || "object" != typeof obj) return obj;
  var copy = obj.constructor();
  for (var attr in obj) {
    if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
  }

  return copy;
}
annotatedRules.forEach(function(annotatedRule) {
  var declarations;

  declarations = annotatedRule.declarations.filter(function(declaration) {
    return !isOverridden(declaration);
  });
  if (declarations.length > 0) {
    rule = {
      type: 'rule',
      selectors: [annotatedRule.selector],
      declarations: declarations,
      source: annotatedRule.source
    };
    if (annotatedRule.media === '') {
      if (lastMedia !== undefined && lastMedia !== '') {
        ast.stylesheet.rules.push({
          type: 'media',
          media: lastMedia,
          rules: clone(mediaRules)
        });
        mediaRules = [];
      }
      ast.stylesheet.rules.push(rule);
      lastMedia = '';
    } else {
      if (mediaRules.length === 0 || annotatedRule.media === lastMedia) {
        mediaRules.push(rule);
        lastMedia = annotatedRule.media;
      } else {
        ast.stylesheet.rules.push({
          type: 'media',
          media: lastMedia,
          rules: clone(mediaRules)
        });

        mediaRules = [rule];
        lastMedia = annotatedRule.media;
      }
    }
  }
});
if (mediaRules.length > 0) {
  ast.stylesheet.rules.push({
    type: 'media',
    media: lastMedia,
    rules: mediaRules
  });
}
//fs.writeFile(outputDir + "./optimized.css", css.stringify(ast));
//fs.writeFile(outputDir + "/optimized.css", css.stringify(ast, {compress: true}), {encoding: 'utf-8'});

//buang semua css dan load optimized.css
$('link').each(function() {
  var filename;

  if (this.type == 'tag' && this.attribs.href != '') {
    if (this.attribs.rel == 'stylesheet' || this.attribs.type == 'text/css') {
      var href = this.attribs.href,
        astPerFile = {
          type: 'stylesheet',
          stylesheet: {
            rules: []
          }
        }
      ;

      ast.stylesheet.rules.forEach(function(rule) {
        if (rule.type == 'media') {
          var media = rule.media,
            astRules = []
          ;

          rule.rules.forEach(function(mediaRule) {
            if (path.join(mediaRule.source) == path.join(path.dirname(file), decodeURIComponent(href))) {
              var selectors = mediaRule.selectors,
                declarations = mediaRule.declarations,
                astRule = {
                  type: 'rule',
                  selectors: selectors,
                  declarations: declarations
                }
              ;
              astRules.push(astRule);
            }
          });
          if (astRules.length > 0) {
            astPerFile.stylesheet.rules.push({
              type: 'media',
              media: media,
              rules: astRules
            });
          }
        } else if (rule.type == 'rule') {
          if (path.join(rule.source) == path.join(path.dirname(file), decodeURIComponent(href))) {
            astPerFile.stylesheet.rules.push({
              type: 'rule',
              selectors: rule.selectors,
              declarations: rule.declarations
            });
          }
        }
      });

      var basePath = path.dirname(file),
        newFilePath = path.join(path.dirname(href), path.basename(href, '.css')) + '-optimized.css'
        decodeNewFilePath = path.join(path.dirname(href), decodeURIComponent(path.basename(href, '.css'))) + '-optimized.css'
      ;
      fs.writeFileSync(path.join(basePath, decodeNewFilePath), css.stringify(astPerFile, {compress: true}), {encoding: 'utf-8'});
      this.attribs.href = newFilePath;
    }
  }
});
//$('head').append('<link rel="stylesheet" type="text/css" href="optimized.css" />');
fs.writeFile(file, $.html({decodeEntities: false}));
