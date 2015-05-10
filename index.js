var fs = require('fs'),
  css = require('css'),
  cheerio = require('cheerio'),
  stylesheet = require('./lib/stylesheet'),
  selectorMatching = require('./lib/selector-matching'),
  cssSpecificity = require('./lib/css-specificity')
;

var file = process.argv[2] ,
  $ = cheerio.load(fs.readFileSync(file))
;

stylesheets = stylesheet.parse($('link'));
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
          selector = rule.selector
        ;

        $(selector).each(function(key, element) {
          nodes.push(element);
        });
        
        annotatedRules.push({
          selector: selector,
          declarations: rule.declarations,
          orderPosition: rule.orderPosition,
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
      declarations = rule.declarations
    ;

    for (var j = 0; j < declarations.length; j++) {
      var declaration = declarations[j];
      declaration.status = declaration.status || {};

      if (declaration.type == 'declaration' && declaration.status[index] === undefined) {
        declaration.status[index] = 'effective';
      }

      for (var k = i + 1; k < orderedRules.length; k++) {
        var nextRule = orderedRules[k];

        for (var l = 0; l < nextRule.declarations.length; l++) {
          var nextDeclaration = nextRule.declarations[l];
          nextDeclaration.status = nextDeclaration.status || {};

          if (nextDeclaration.type == 'declaration' && nextDeclaration.property == declaration.property) {
            nextDeclaration.status[index] = 'overridden';
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
//console.log(isOverridden(annotatedRules[2].declarations[0]));

// Find unused rules
var findUnusedRules = function(annotatedRules) {
  var unusedRules = [],
    orderPosition = 1
  ;
  stylesheets.forEach(function(stylesheet) {
    var rules = stylesheet.stylesheet.rules;

    rules.forEach(function(rule) {
      if (rule.type == 'rule') {
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
    });
  });

  return unusedRules;
};
//var unusedRules = findUnusedRules(annotatedRules);
//console.log(unusedRules[0].declarations);

// Print out the optimized css
var cssData = '';
annotatedRules.forEach(function(annotatedRule) {
  var declarations, ast;

  declarations = annotatedRule.declarations.filter(function(declaration) {
    return !isOverridden(declaration);
  });
  if (declarations.length > 0) {
    ast = {
      type: 'stylesheet',
      stylesheet: {
        rules: [
          {
            type: 'rule',
            selectors: [annotatedRule.selector],
            declarations: declarations
          }
        ]
      }
    };
    cssData += css.stringify(ast, {compress: true});
  }
});
fs.writeFile("./optimized.css", cssData);
