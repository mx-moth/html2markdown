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
		return html2markdown.handleNode(node, options);
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
	 */
	html2markdown.handleChildren = function(node, options) {
		return html2markdown.handleNodes(nodeListToArray(node.childNodes), options);
	
	}
	
	/**
	 * Function: handleNodes
	 *
	 * Call handleNode for each element in the array.
	 *
	 * Parameters:
	 *   arr - An array of HTML elements
	 *   options - Options to pass to handleNode
	 */
	html2markdown.handleNodes = function(arr, options) {
		return arr.map(function(node) {
			return html2markdown.handleNode(node, options);
		}).join('');
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
	 */
	html2markdown.handleNode = function(node, options) {
		if (node.nodeType === NODE_TYPE_TEXT) {
			if (options.normalizeWhitespace) {
				return html2markdown.normalizeText(node.nodeValue);
			} else {
				return html2markdown.escapeText(node.nodeValue);
			}
		}

		var nodeName = node.nodeName.toLowerCase();
		var types = html2markdown.handleNode.types;
		if (nodeName in types) {
			return types[nodeName](node, options);
		} else {
			return html2markdown.handleNode.other(node, options);
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
		a: function(node, options) {
			var out = []
			out.push('[');
			out.push(html2markdown.handleChildren(node, options));
			out.push('](');
			out.push(html2markdown.normalizeText(node.href));
			if (node.title) {
				out.push(' "');
				out.push(html2markdown.normalizeText(node.title));
				out.push('"');
			}
			out.push(')');
			return out.join('');
		},

		heading: function(node, number, options) {
			var out = [];
			number = number + options.headerOffset;

			while (number--) out.push('#');
			out.push(' ');
			out.push(html2markdown.handleChildren(node, options));
			out.push('\n\n');

			return out.join('');
		},
		h1: function(node, options) { return types.heading(node, 1, options); },
		h2: function(node, options) { return types.heading(node, 2, options); },
		h3: function(node, options) { return types.heading(node, 3, options); },
		h4: function(node, options) { return types.heading(node, 4, options); },
		h5: function(node, options) { return types.heading(node, 5, options); },
		h6: function(node, options) { return types.heading(node, 6, options); },

		p: function(node, options) {
			return html2markdown.handleChildren(node, options) + '\n\n';
		},

		div: function(node, options) {
			var importantNodes = nodeListToArray(node.childNodes).filter(function(node) {
				return node.nodeType !== NODE_TYPE_TEXT;
			});
			return html2markdown.handleNodes(importantNodes, options);
		},

		inlineWrap: function(node, wrap, options) {
			return wrap + html2markdown.handleChildren(node, options) + wrap;
		},

		b:      function(node, options) { return types.inlineWrap(node, '**', options); },
		strong: function(node, options) { return types.b.apply(types, arguments); },

		i:  function(node, options) { return types.inlineWrap(node, '*', options); },
		em: function(node, options) { return types.i.apply(types, arguments); },

		u: function(node, options) { return types.inlineWrap(node, '_', options); },

		list: function(node, options) {
			var importantNodes = nodeListToArray(node.childNodes).filter(function(node) {
				return node.nodeType !== NODE_TYPE_TEXT && node.nodeName.toLowerCase() == 'li';
			});
			return html2markdown.handleNodes(importantNodes, options);
		},
		ol: function() { return types.list.apply(types, arguments); },
		ul: function() { return types.list.apply(types, arguments); },

		li: function(node, options) {
			var text = html2markdown.handleChildren(node, options);

			var type = {
				'ol': '# ',
				'ul': '* ',
			}[node.parentNode.nodeName.toLowerCase()];

			return type + indentLines(text.trim(), '    ', false) + '\n\n';
		},

		pre: function(node, options) {
			var oldNW = options.normalizeWhitespace;
			options.normalizeWhitespace = false;

			output = html2markdown.handleChildren(node, options);

			options.normalizeWhitespace = oldNW;

			return indentLines(output, '    ', true) + '\n\n';
		},
		code: function(node, options) {
			if (node.parentNode.nodeName.toLowerCase() === 'pre') {
				return html2markdown.handleChildren(node, options);
			} else {
				return types.inlineWrap(node, '`', options);
			}
		},
	};
	html2markdown.handleNode.other = html2markdown.handleChildren;

	var nodeListToArray = function(nodeList) {
		return [].slice.call(nodeList);
	};

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
