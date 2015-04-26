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
        var selectors = rule.selectors;

        selectors.forEach(function(selector) {
          var rightMostSelector = getRightMostSelector(selector);

          if (rightMostSelector[0] == '#') {
            if (rightMostSelector in hashtable.id) {
              hashtable.id[rightMostSelector].push(selector);
            } else {
              hashtable.id[rightMostSelector] = [selector];
            }
            //idHashtable.push(selector);
          } else if (rightMostSelector[0] == '.') {
            if (rightMostSelector in hashtable.class) {
              hashtable.class[rightMostSelector].push(selector);
            } else {
              hashtable.class[rightMostSelector] = [selector];
            }
            //classHashtable.push(selector);
          } else if (rightMostSelector.match(/^\w+/)) {
            if (rightMostSelector in hashtable.tag) {
              hashtable.tag[rightMostSelector].push(selector);
            } else {
              hashtable.tag[rightMostSelector] = [selector];
            }
            //tagHashtable.push(selector);
          } else {
            if (rightMostSelector in hashtable.uncategorized) {
              hashtable.uncategorized[rightMostSelector].push(selector);
            } else {
              hashtable.uncategorized[rightMostSelector] = [selector];
            }
            //uncategorizedHashtable.push(selector);
          }
        });
      }
    });
  });

  // selector matching
  var attributes = dom.attribs;
  var matchedSelectors = [];
  if (attributes !== undefined) {
    if ('id' in attributes) {
      var selectors = hashtable.id['#'+attributes.id];

      if (selectors !== undefined) {
        selectors.forEach(function(selector) {
          if ($(dom).is(selector)) {
            matchedSelectors.push(selector);
          }
        });
      }
      //idHashtable.forEach(function(selector) {
        //var rightMostSelector = getRightMostSelector(selector);

        //if (rightMostSelector == ('#'+attributes.id)) {
          //matchedSelectors.push(selector);
        //}
      //});
    }
    if ('class' in attributes) {
      var selectors = hashtable.class['.'+attributes.class];

      if (selectors !== undefined) {
        selectors.forEach(function(selector) {
          if ($(dom).is(selector)) {
            matchedSelectors.push(selector);
          }
        });
      }
      //classHashtable.forEach(function(selector) {
        //var rightMostSelector = getRightMostSelector(selector);

        //if (rightMostSelector == ('.'+attributes.class)) {
          //matchedSelectors.push(selector);
        //}
      //});
    }

    // select from tag hashtable
    var selectors = hashtable.tag[dom.name];
    if (selectors !== undefined) {
      selectors.forEach(function(selector) {
        if ($(dom).is(selector)) {
          matchedSelectors.push(selector);
        }
      });
    }
    //tagHashtable.forEach(function(selector) {
      //var rightMostSelector = getRightMostSelector(selector);

      //if (rightMostSelector == dom.name) {
        //matchedSelectors.push(selector);
      //}
    //});

    // select from uncategorized
    for (property in hashtable.uncategorized) {
      var selectors = hashtable.uncategorized[property];
      selectors.forEach(function(selector) {
        if ($(dom).is(selector)) {
          matchedSelectors.push(selector);
        }
      });
    }

    //uncategorizedHashtable.forEach(function(selector) {
      //var rightMostSelector = getRightMostSelector(selector),
        //selectors = hashtable.uncategorized[rightMostSelector]
      //;

      //selectors.forEach(function(selector) {
        //if ($(dom).is(selector)) {
          //matchedSelectors.push(selector);
        //}
      //});
      //var rightMostSelector = getRightMostSelector(selector);

      //if (rightMostSelector == ('#'+attributes.id)) {
        //matchedSelectors.push(selector);
      //}
    //});
  }

  //console.log(matchedSelectors);
  return matchedSelectors;
};
//selectorMatching($('div')[0]);

// Algorithm Matched Selector
var annotatedRules = [],
  stack = [$('body')[0]]
;
while (stack.length > 0) {
  var node = stack.pop(),
    children = [],
    matchedSelectors
  ;

  if (node.children !== undefined) {
    node.children.forEach(function(child) {
      if (child.type == 'tag') {
        children.push(child);
      }
    });
    stack = stack.concat(children);
  }

  matchedSelectors = selectorMatching(node);
  matchedSelectors.forEach(function(selector) {
    var nodes = [];

    $(selector).each(function(key, element) {
      nodes.push(element);
    });
    
    annotatedRules.push({
      selector: selector,
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
