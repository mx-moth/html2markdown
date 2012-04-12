(function(window, document) {
	var NODE_TYPE_TEXT = 3;

	/**
	 * Function: html2markdown
	 *
	 * Generate the markdown equivalent of an HTML node
	 *
	 * Parameters:
	 *   node - The node in question
	 *   options - Options for the generator. See `html2markdown.options`
	 *
	 * Returns:
	 * The Markdown text representation of the node
	 */
	var html2markdown = window.H2M = function(node, options) {
		options = extendObject({}, html2markdown.options, options);
		return collectOutput(html2markdown.handleNode, [node, options]).join('');
	};

	/**
	 * Namespace: html2markdown
	 */

	html2markdown.options = {
		normalizeWhitespace: true,
		headerOffset: 0,
	};

	html2markdown.specialChars = /^([*_\[\]\\])/ig;

	/**
	 * Function: escapeText
	 *
	 * Normalize whitespace, and escape special characters
	 *
	 * Parameters:
	 *   text - The text to escape
	 * 
	 * Returns:
	 * The escaped text
	 */
	html2markdown.normalizeText = function(text) {
		return html2markdown.escapeText(text.replace(/[\s\n\r]+/g, ' ')) // Normalize whitespace
	};

	html2markdown.escapeText = function(text) {
		return text
			.replace(html2markdown.specialChars, '\\\1')
	};

	/**
	 * Function: handleChildren
	 *
	 * Take an element, and run `html2markdown.handleNode` on each of
	 * its child nodes
	 *
	 * Parameters:
	 *   node - The node in question
	 *   options - Options to pass to `html2markdown.handleNode`
	 *   output - The output callback
	 */
	html2markdown.handleChildren = function(node, options, output) {
		html2markdown.handleNodes(nodeListToArray(node.childNodes), options, output);
	
	}
	
	html2markdown.handleNodes = function(arr, options, output) {
		arr.forEach(function(node) {
			html2markdown.handleNode(node, options, output);
		});
	}

	/**
	 * Function: handleNode
	 *
	 * Given an HTML element, generate the Markdown code to represent
	 * it.
	 *
	 * Parameters:
	 *   node - The HTML node in question
	 *   options - Options hash. See `html2markdown.options`
	 *   output - A callback function that is called with the output of this node.
	 *     This may be called multiple times.
	 */
	html2markdown.handleNode = function(node, options, output) {
		if (node.nodeType === NODE_TYPE_TEXT) {
			if (options.normalizeWhitespace) {
				output(html2markdown.normalizeText(node.nodeValue));
			} else {
				output(html2markdown.escapeText(node.nodeValue));
			}
			return;
		}

		var nodeName = node.nodeName.toLowerCase();
		var types = html2markdown.handleNode.types;
		if (nodeName in types) {
			types[nodeName](node, options, output);
		} else {
			html2markdown.handleNode.other(node, options, output);
		}

	};

	/**
	 * Namespace: html2markdown.handleNode
	 */

	/**
	 * Variable: types
	 *
	 * A hash of node name -> handler function to generate Markdown
	 * representations of nodes
	 */
	var types = html2markdown.handleNode.types = {
		a: function(node, options, output) {
			output('[');
			html2markdown.handleChildren(node, options, output);
			output('](');
			output(html2markdown.normalizeText(node.href));
			if (node.title) {
				output(' "');
				output(html2markdown.normalizeText(node.title));
				output('"');
			}
			output(')');
		},

		heading: function(node, number, options, output) {
			number = number + options.headerOffset;
			while (number--) output('#');
			output(' ');
			html2markdown.handleChildren(node, options, output);
			output('\n\n');
		},
		h1: function(node, options, output) { types.heading(node, 1, options, output); },
		h2: function(node, options, output) { types.heading(node, 2, options, output); },
		h3: function(node, options, output) { types.heading(node, 3, options, output); },
		h4: function(node, options, output) { types.heading(node, 4, options, output); },
		h5: function(node, options, output) { types.heading(node, 5, options, output); },
		h6: function(node, options, output) { types.heading(node, 6, options, output); },

		p: function(node, options, output) {
			html2markdown.handleChildren(node, options, output);
			output('\n\n');
		},

		div: function(node, options, output) {
			var importantNodes = nodeListToArray(node.childNodes).filter(function(node) {
				return node.nodeType !== NODE_TYPE_TEXT;
			});
			html2markdown.handleNodes(importantNodes, options, output);
		},

		b: function(node, options, output) {
			output('**');
			html2markdown.handleChildren(node, options, output);
			output('**');
		},
		strong: function() { types.b.apply(types, arguments); },

		i: function(node, options, output) {
			output('*');
			html2markdown.handleChildren(node, options, output);
			output('*');
		},
		em: function() { types.i.apply(types, arguments); },

		u: function(node, options, output) {
			output('_');
			html2markdown.handleChildren(node, options, output);
			output('_');
		},

		ol: function(node, options, output) {
			var importantNodes = nodeListToArray(node.childNodes).filter(function(node) {
				return node.nodeType !== NODE_TYPE_TEXT && node.nodeName.toLowerCase() == 'li';
			});
			html2markdown.handleNodes(importantNodes, options, output);
		},
		ul: function() { types.ol.apply(types, arguments); },

		li: function(node, options, output) {
			var text = collectOutput(html2markdown.handleChildren, [node, options]).join('');

			var type = {
				'ol': '# ',
				'ul': '* ',
			}[node.parentNode.nodeName.toLowerCase()];

			output(type);
			output(indentLines(text.trim(), '    ', false));
			output('\n\n');
		},

		pre: function(node, options, output) {
			var oldNW = options.normalizeWhitespace;
			options.normalizeWhitespace = false;
			output(indentLines(collectOutput(html2markdown.handleChildren, [node, options]).join('').trim(), '    ', true));
			output('\n\n');
			options.normalizeWhitespace = oldNW;
		},
		code: function(node, options, output) {
			if (node.parentNode.nodeName.toLowerCase() === 'pre') {
				html2markdown.handleChildren(node, options, output);
			} else {
				output('`');
				html2markdown.handleChildren(node, options, output);
				output('`');
			}
		},
	};
	html2markdown.handleNode.other = html2markdown.handleChildren;

	var nodeListToArray = function(nodeList) {
		return [].slice.call(nodeList);
	};

	var collectOutput = function(fn, args) {
		var output = [];
		args.push(function(a) {
			output.push(a);
		});
		fn.apply(null, args);
		return output;
	}

	var indentLines = function(text, indent, firstLine) {
		if (arguments.length < 3) firstLine = true;
		if (firstLine) {
			return text.replace(/^/gm, indent);
		} else {
			return text.replace(/\A/gm, indent);
		}
	};

	var extendObject = function() {
		var args = [].slice.call(arguments, 0);
		var base = args.shift();
		args.forEach(function(arg) {
			if (arg) for (var x in arg) {
				base[x] = arg[x];
			}
		});
		return base;
	}

})(window, document);
