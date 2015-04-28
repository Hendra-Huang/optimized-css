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
selectableDOM.forEach(function(dom) {
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

      if (declaration.type == 'declaration' && i === 0) {
        declaration.status = 'effective';
      }

      for (var k = i + 1; k < orderedRules.length; k++) {
        var nextRule = orderedRules[k];

        for (var l = 0; l < nextRule.declarations.length; l++) {
          var nextDeclaration = nextRule.declarations[l];

          if (nextDeclaration.type == 'declaration' && nextDeclaration.property == declaration.property) {
            nextDeclaration.status = 'overriden';
          }
        }
      }
    }
  }
});
console.log(annotatedRules[0].declarations);

//var result = css.stringify(ast);
//console.log(ast.stylesheet.rules[0]);
//console.log(result);
//console.log($("#a").is(rule.selector));
