var fs = require('fs'),
  css = require('css'),
  cheerio = require('cheerio')
;
var Stylesheet = require('./lib/stylesheet');

var file = process.argv[2] ,
  $ = cheerio.load(fs.readFileSync(file))
;

stylesheets = new Stylesheet($('link'));

var selectorMatching = function(dom) {
  var hashtable = {
    id: {},
    class: {},
    tag: {},
    uncategorized: {}
  };

  var getRightMostSelector = function(selector) {
    var selectorToken = /(?=\.)|(?=#)|(?=\[)/,
      tokenizedSelector = selector.split(selectorToken)
    ;

    return tokenizedSelector.pop();
  }

  // generate hashtable
  stylesheets.forEach(function(stylesheet) {
    var rules = stylesheet.stylesheet.rules;

    rules.forEach(function(rule) {
      if (rule.type == 'rule') {
        var selectors = rule.selectors,
          declarations = rule.declarations
        ;

        selectors.forEach(function(selector) {
          var rightMostSelector = getRightMostSelector(selector);

          if (rightMostSelector[0] == '#') {
            if (rightMostSelector in hashtable.id) {
              hashtable.id[rightMostSelector].push({selector: selector, declarations: declarations});
            } else {
              hashtable.id[rightMostSelector] = [{selector: selector, declarations: declarations}];
            }
            //idHashtable.push(selector);
          } else if (rightMostSelector[0] == '.') {
            if (rightMostSelector in hashtable.class) {
              hashtable.class[rightMostSelector].push({selector: selector, declarations: declarations});
            } else {
              hashtable.class[rightMostSelector] = [{selector: selector, declarations: declarations}];
            }
            //classHashtable.push(selector);
          } else if (rightMostSelector.match(/^\w+/)) {
            if (rightMostSelector in hashtable.tag) {
              hashtable.tag[rightMostSelector].push({selector: selector, declarations: declarations});
            } else {
              hashtable.tag[rightMostSelector] = [{selector: selector, declarations: declarations}];
            }
            //tagHashtable.push(selector);
          } else {
            if (rightMostSelector in hashtable.uncategorized) {
              hashtable.uncategorized[rightMostSelector].push({selector: selector, declarations: declarations});
            } else {
              hashtable.uncategorized[rightMostSelector] = [{selector: selector, declarations: declarations}];
            }
            //uncategorizedHashtable.push(selector);
          }
        });
      }
    });
  });

  // selector matching
  var attributes = dom.attribs;
  var matchedRules = [];
  if (attributes !== undefined) {
    if ('id' in attributes) {
      var rules = hashtable.id['#'+attributes.id];

      if (rules !== undefined) {
        rules.forEach(function(rule) {
          var selector = rule.selector;

          if ($(dom).is(selector)) {
            matchedRules.push(rule);
          }
        });
      }
      //idHashtable.forEach(function(selector) {
        //var rightMostSelector = getRightMostSelector(selector);

        //if (rightMostSelector == ('#'+attributes.id)) {
          //matchedRules.push(selector);
        //}
      //});
    }
    if ('class' in attributes) {
      var rules = hashtable.class['.'+attributes.class];

      if (rules !== undefined) {
        rules.forEach(function(rule) {
          var selector = rule.selector;

          if ($(dom).is(selector)) {
            matchedRules.push(rule);
          }
        });
      }
      //classHashtable.forEach(function(selector) {
        //var rightMostSelector = getRightMostSelector(selector);

        //if (rightMostSelector == ('.'+attributes.class)) {
          //matchedRules.push(selector);
        //}
      //});
    }

    // select from tag hashtable
    var rules = hashtable.tag[dom.name];
    if (rules !== undefined) {
      rules.forEach(function(rule) {
        var selector = rule.selector;

        if ($(dom).is(selector)) {
          matchedRules.push(rule);
        }
      });
    }
    //tagHashtable.forEach(function(selector) {
      //var rightMostSelector = getRightMostSelector(selector);

      //if (rightMostSelector == dom.name) {
        //matchedRules.push(selector);
      //}
    //});

    // select from uncategorized
    for (property in hashtable.uncategorized) {
      var rules = hashtable.uncategorized[property];
      rules.forEach(function(rule) {
        var selector = rule.selector;

        if ($(dom).is(selector)) {
          matchedRules.push(rule);
        }
      });
    }

    //uncategorizedHashtable.forEach(function(selector) {
      //var rightMostSelector = getRightMostSelector(selector),
        //selectors = hashtable.uncategorized[rightMostSelector]
      //;

      //selectors.forEach(function(selector) {
        //if ($(dom).is(selector)) {
          //matchedRules.push(selector);
        //}
      //});
      //var rightMostSelector = getRightMostSelector(selector);

      //if (rightMostSelector == ('#'+attributes.id)) {
        //matchedRules.push(selector);
      //}
    //});
  }

  //console.log(matchedRules);
  return matchedRules;
};
//selectorMatching($('div')[0]);

// Algorithm Matched Selector
var annotatedRules = [],
  stack = [$('body')[0]]
;
while (stack.length > 0) {
  var node = stack.pop(),
    children = [],
    matchedRules
  ;

  if (node.children !== undefined) {
    node.children.forEach(function(child) {
      if (child.type == 'tag') {
        children.push(child);
      }
    });
    stack = stack.concat(children);
  }

  matchedRules = selectorMatching(node);
  matchedRules.forEach(function(rule) {
    var nodes = [],
      selector = rule.selector
    ;

    $(selector).each(function(key, element) {
      nodes.push(element);
    });
    
    annotatedRules.push({
      selector: selector,
      declarations: rule.declarations,
      matched: true,
      matchedNodes: nodes
    });
  });
}
console.log(annotatedRules);

//var result = css.stringify(ast);
//console.log(ast.stylesheet.rules[0]);
//console.log(result);
//console.log($("#a").is(rule.selector));
