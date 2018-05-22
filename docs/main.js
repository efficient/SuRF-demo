"use strict";

Vue.component('network', vue2vis.Network);

// surf component
Vue.component('surf', {
  // Template
  template: '#surf-template',

  // Properties
  props: {
    'initial_input': {
      default: ''
    },
    'initial_include_dense': {
      default: true,
      type: Boolean
    },
    'initial_sparse_dense_ratio': {
      default: '16'
    },
    'initial_suffix_type': {
      default: function() {
        return [];
      }
    },
    'initial_suffix_len': {
      default: '8'
    },
    'initial_query_type': {
      'default': 'none'
    },
    'initial_point_query_key': {
      'default': ''
    },
    'initial_range_query_begin_key': {
      'default': ''
    },
    'initial_range_query_begin_inclusive': {
      'default': true
    },
    'initial_range_query_end_key': {
      'default': ''
    },
    'initial_range_query_end_inclusive': {
      'default': true
    },
    'initial_show_tree': {
      'default': true
    },
    'initial_show_details': {
      'default': false
    }
  },

  // Data
  data: function() {
    return {
      'input': this.initial_input,
      'include_dense': this.initial_include_dense,
      'sparse_dense_ratio': this.initial_sparse_dense_ratio,
      'suffix_type': this.initial_suffix_type,
      'suffix_len': this.initial_suffix_len,
      'query_type': this.initial_query_type,
      'point_query_key': this.initial_point_query_key,
      'range_query_begin_key': this.initial_range_query_begin_key,
      'range_query_begin_inclusive': this.initial_range_query_begin_inclusive,
      'range_query_end_key': this.initial_range_query_end_key,
      'range_query_end_inclusive': this.initial_range_query_end_inclusive,
      'show_tree': this.initial_show_tree,
      'show_details': this.initial_show_details,
    };
  },

  created: function() {
    this.filter_ = null;
    this.filter_ah_ = null;
    this.builder_ = null;
    this.builder_ah_ = null;

    this.tree_next_node_id_ = 0;
  },

  destroyed: function() {
    if (this.filter_ !== null) {
      this.builder_ah_.delete();
      this.builder_.delete();
      this.filter_ah_.delete();
      this.filter_.destroy();
      this.filter_.delete();
    }
  },

  // Computed data
  computed: {
    // Keys (sanitized)
    keys: function() {
      var lines = this.input.match(/[^\r\n]+/g);
      if (lines === null) {
        lines = [];
      } else {
        var unique_sorted = function(array) {
          var unique = [];
          if (array.length > 0) {
            unique.push(array[0]);
            for (var i = 1; i < array.length; i++) {
              if (array[i - 1] != array[i]) {
                unique.push(array[i]);
              }
            }
          }
          return unique;
        };

        lines.sort();
        lines = unique_sorted(lines);
      }
      return lines;
    },

    // Prefix tree
    tree: function() {
      // Implements a SuRF construction using a level-order visit (BFS).
      // This does not require per-level state during construction,
      // but is slower compared to incremental construction in the reference SuRF implementation
      // because of its memory access pattern.
      var keys = this.keys;

      var getVisNode = function(node) {
        return {
          id: node.id,
          label: node.label,
          title: node.title,
          shape: node.shape
        };
      };

      var suffix_id = 0;
      var full_nodes = [];
      var levels = [];
      var nodes = [];
      var edges = [];
      var base_node_id = this.tree_next_node_id_;

      var suffix_labels;
      if (this.suffix_type.length != 0) {
        suffix_labels = this.getSuffixLabels().flatten();
      }

      var addNode = function(parent, level, key_offset, key_count) {
        var node = {
          id: base_node_id + nodes.length,
          label: '    ', // Required to correct change updates by vue2vis
          level: level,
          key_offset: key_offset,
          key_count: key_count,
          children: {}
        };

        if (key_count == 1) {
          node.suffix_id = suffix_id;
          if (suffix_labels === undefined) {
            // node.label = '(s' + suffix_id + ')';
            node.label = '\u2205';
          } else {
            node.label = suffix_labels[suffix_id];
          }
          node.title = 'Suffix of key "' + keys[key_offset] + '"';
          node.shape = 'box';
          suffix_id++;
        } else {
          if (key_offset < keys.length) {
            node.title = 'Common prefix "' + keys[key_offset].substr(0, level) + '"';
          } else {
            node.title = 'Common prefix ""';
          }
          node.shape = 'circle';
        }

        full_nodes.push(node);
        if (node.level < levels.length) {
          levels[node.level].push(node);
        } else {
          levels.push([node]);
        }
        nodes.push(getVisNode(node));

        if (parent != null) {
          var edge = {
            from: parent.id,
            to: node.id
          };

          var letter;
          if (level - 1 < keys[key_offset].length) {
            edge.label = letter = keys[key_offset][level - 1];
          } else {
            edge.label = '$';
            letter = Module.surf_kTerminator;
          }

          edges.push(edge);
          parent.children[letter] = {
            node_idx: nodes.length - 1,
            edge_idx: edges.length - 1
          };
        }
      };

      addNode(null, 0, 0, keys.length);

      for (var id = 0; id < nodes.length; id++) {
        var node = full_nodes[id];
        var level = node.level;
        var key_offset = node.key_offset;
        var key_count = node.key_count;

        if (key_count <= 1)
          continue;

        var common_length = -1;
        var common_letter = -1;
        var common_key_offset = -1;
        for (var i = key_offset; i < key_offset + key_count; i++) {
          var length = keys[i].length;
          var letter = Module.surf_kTerminator;
          if (level < keys[i].length) {
            length = level;
            letter = keys[i][level];
          }
          if (common_length != length || common_letter != letter) {
            if (common_key_offset != -1) {
              addNode(node, level + 1, common_key_offset, i - common_key_offset);
            }
            common_length = length;
            common_letter = letter;
            common_key_offset = i;
          }
        }
        addNode(node, level + 1, common_key_offset, (key_offset + key_count) - common_key_offset);
      };

      this.tree_next_node_id_ += nodes.length;

      return {
        full_nodes: full_nodes,
        levels: levels,
        nodes: nodes,
        edges: edges
      };
    },

    // SuRF data structures
    surf: function() {
      if (this.filter_ !== null) {
        this.builder_ah_.delete();
        this.builder_.delete();
        this.filter_ah_.delete();
        this.filter_.destroy();
        this.filter_.delete();

        this.builder_ah_ = null;
        this.builder_ = null;
        this.filter_ah_ = null;
        this.filter_ = null;
      }

      var keys = this.keys;
      if (keys.length > 0) {
        var include_dense = this.include_dense;
        var sparse_dense_ratio = parseInt(this.sparse_dense_ratio);
        if (!(sparse_dense_ratio >= 0)) {
          sparse_dense_ratio = parseInt(this.initial_sparse_dense_ratio);
        }
        var suffix_type;
        var suffix_len = parseInt(this.suffix_len);
        if (!(suffix_len >= 1 && suffix_len <= 64)) {
          suffix_len = parseInt(this.initial_suffix_len);
        }
        var hash_suffix_len = 0;
        var real_suffix_len = 0;
        if (this.suffix_type.indexOf('hash') != -1 && this.suffix_type.indexOf('real') != -1) {
          suffix_type = Module.surf_SuffixType.kMixed;
          hash_suffix_len = real_suffix_len = suffix_len;
        } else if (this.suffix_type.indexOf('hash') != -1) {
          suffix_type = Module.surf_SuffixType.kHash;
          hash_suffix_len = suffix_len;
        } else if (this.suffix_type.indexOf('real') != -1) {
          suffix_type = Module.surf_SuffixType.kReal;
          real_suffix_len = suffix_len;
        } else
          suffix_type = Module.surf_SuffixType.kNone;

        var builder_keys = new Module.VectorString();
        for (var i = 0; i < keys.length; i++) {
          builder_keys.push_back(keys[i]);
        }

        this.builder_ = new Module.surf_SuRFBuilder(include_dense, sparse_dense_ratio, suffix_type, hash_suffix_len, real_suffix_len);
        this.builder_.build(builder_keys);

        this.builder_ah_ = new Module.surf_SuRFBuilderAccessHelper(this.builder_);

        this.filter_ = new Module.surf_SuRF(builder_keys, include_dense, sparse_dense_ratio, suffix_type, hash_suffix_len, real_suffix_len);

        this.filter_ah_ = new Module.surf_SuRFAccessHelper(this.filter_);

        builder_keys.delete();
      }

      return {
        builder: this.builder_,
        builder_ah: this.builder_ah_,
        filter: this.filter_,
        filter_ah: this.filter_ah_
      };
    },

    // vis.js nodes and edges
    nodes_edges: function() {
      return this.highlightQueryResult();
    },

    // vis.js options
    options: function() {
      return {
        nodes: {
          font: {
            size: 20
          }
        },
        edges: {
          font: {
            size: 20,
            vadjust: -20
          },
          smooth: false,
          arrows: {
            to: true
          }
        },
        layout: {
          hierarchical: {
            sortMethod: 'directed',
            levelSeparation: 120,
            nodeSpacing: 120
          }
        },
        interaction: {
          dragNodes: false,
          navigationButtons: true,
          hover: true,
          hoverConnectedEdges: false,
          // multiselect: true,
          // selectable: true,
          // selectConnectedEdges: false,
          selectable: false,
          tooltipDelay: 100
        },
        physics: {
          enabled: false
        }
      };
    },

    // SuRF query results
    lookupKeyResult: function() {
      return this.lookupKey(this.point_query_key);
    },
    lookupRangeResult: function() {
      return this.lookupRange(this.range_query_begin_key, this.range_query_begin_inclusive, this.range_query_end_key, this.range_query_end_inclusive);
    },
    exactLookupKeyResult: function() {
      return this.exactLookupKey(this.point_query_key);
    },
    exactLookupRangeResult: function() {
      return this.exactLookupRange(this.range_query_begin_key, this.range_query_begin_inclusive, this.range_query_end_key, this.range_query_end_inclusive);
    },

    // SuRF data structure details
    serialized_size: function() {
      if (this.surf.filter_ah === null) {
        return 0;
      } else {
        return this.surf.filter_ah.serializedSize();
      }
    },
    memory_usage: function() {
      if (this.surf.filter_ah === null) {
        return 0;
      } else {
        return this.surf.filter_ah.getMemoryUsage();
      }
    },

    tree_height: function() {
      if (this.surf.builder === null) {
        return 0;
      } else {
        return this.surf.builder.getTreeHeight();
      }
    },
    sparse_start_level: function() {
      if (this.surf.builder === null) {
        return 0;
      } else {
        return this.surf.builder.getSparseStartLevel();
      }
    },


    bitmap_labels: function() {
      if (this.surf.builder_ah === null) {
        return [];
      } else {
        var builder_ah = this.surf.builder_ah;
        return this.getArrayArray64(function(x, y) {
          return builder_ah.getBitmapLabels(x, y);
        });
      }
    },
    bitmap_child_indicator_bits: function() {
      if (this.surf.builder_ah === null) {
        return [];
      } else {
        var builder_ah = this.surf.builder_ah;
        return this.getArrayArray64(function(x, y) {
          return builder_ah.getBitmapChildIndicatorBits(x, y);
        });
      }
    },
    prefixkey_indicator_bits: function() {
      if (this.surf.builder_ah === null) {
        return [];
      } else {
        var builder_ah = this.surf.builder_ah;
        return this.getArrayArray64(function(x, y) {
          return builder_ah.getPrefixkeyIndicatorBits(x, y);
        });
      }
    },

    labels: function() {
      if (this.surf.builder_ah === null) {
        return [];
      } else {
        var builder_ah = this.surf.builder_ah;
        return this.getArrayArray(function(x, y) {
          return builder_ah.getLabels(x, y);
        });
      }
    },
    child_indicator_bits: function() {
      if (this.surf.builder_ah === null) {
        return [];
      } else {
        var builder_ah = this.surf.builder_ah;
        return this.getArrayArray64(function(x, y) {
          return builder_ah.getChildIndicatorBits(x, y);
        });
      }
    },
    louds_bits: function() {
      if (this.surf.builder_ah === null) {
        return [];
      } else {
        var builder_ah = this.surf.builder_ah;
        return this.getArrayArray64(function(x, y) {
          return builder_ah.getLoudsBits(x, y);
        });
      }
    },

    suffixes: function() {
      if (this.surf.builder_ah === null) {
        return [];
      } else {
        var builder_ah = this.surf.builder_ah;
        return this.getArrayArray64(function(x, y) {
          return builder_ah.getSuffixes(x, y);
        });
      }
    },

    suffix_counts: function() {
      if (this.surf.builder_ah === null) {
        return [];
      } else {
        var builder_ah = this.surf.builder_ah;
        return this.getArray(function(x) {
          return builder_ah.getSuffixCounts(x);
        });
      }
    },
    node_counts: function() {
      if (this.surf.builder_ah === null) {
        return [];
      } else {
        var builder_ah = this.surf.builder_ah;
        return this.getArray(function(x) {
          return builder_ah.getNodeCounts(x);
        });
      }
    },
    actual_suffix_len: function() {
      if (this.surf.builder === null) {
        return [];
      } else {
        var builder = this.surf.builder;
        return builder.getSuffixLen();
      }
    }
  },

  methods: {
    // Formatters
    formatBitvector: function(array, group_size) {
      var s = '';
      var total = 0;
      for (var i = 0; i < array.length; i++) {
        var value = array[i];
        // console.log(value);
        for (var offset = 0; offset < 32; offset++, total++) {
          s += (value & (0x80000000 >>> offset)) != 0 ? '1' : '0';
          if (group_size != 0 && total % group_size == group_size - 1) {
            s += ' ';
          }
        }
      }
      if (s.length != 0) {
        s = s.slice(0, s.length - 1);
      }
      return s;
    },
    formatBitvectorPartial: function(array, count, group_size) {
      var s = '';
      var total = 0;
      for (var i = 0; i < array.length; i++) {
        var value = array[i];
        // console.log(value);
        for (var offset = 0; offset < 32 && total < count; offset++, total++) {
          s += (value & (0x80000000 >>> offset)) != 0 ? '1' : '0';
          if (group_size != 0 && total % group_size == group_size - 1) {
            s += ' ';
          }
        }
      }
      if (s.length != 0) {
        s = s.slice(0, s.length - 1);
      }
      return s;
    },
    convertBinaryToLetters: function(array) {
      var output = [];
      for (var i = 0; i < array.length; i++) {
        var binval = array[i];
        var letters = '';
        var printable = true;
        for (var j = 0; j < binval.length; j += 8) {
          var code = parseInt(binval.slice(j, j + 8), 2);
          if (code < 0x20 || code > 0x7e) {
            printable = false;
            break;
          }
        }
        for (var j = 0; j < binval.length; j += 8) {
          var code = parseInt(binval.slice(j, j + 8), 2);
          if (printable) {
            letters += String.fromCharCode(code);
          } else {
            letters += code.toString(16);
          }
        }
        if (letters.length == 0) {
          letters = '\u2205';
        } else if (!printable) {
          if (letters.length % 2 == 0) {
            letters = '0x' + letters;
          } else {
            letters = '0x0' + letters;
          }
        }
        output.push(letters);
      }
      return output;
    },


    // SuRF constants
    getTerminator: function() {
      return Module.surf_kTerminator;
    },

    // SuRF binary data access functions
    getArray: function(func) {
      var values_ = new Module.VectorValue();
      func(values_);

      var arr = [];
      for (var i = 0; i < values_.size(); i++) {
        arr.push(values_.get(i));
      }

      values_.delete();
      return arr;
    },
    getArrayArray: function(func) {
      var sizes = new Module.VectorValue();
      var values_ = new Module.VectorValue();
      func(sizes, values_);

      var arrarr = [];
      var offset = 0;
      for (var i = 0; i < sizes.size(); i++) {
        var size = sizes.get(i);
        var arr = [];
        while (size > 0) {
          arr.push(values_.get(offset));
          offset++;
          size--;
        }
        arrarr.push(arr);
      }

      sizes.delete();
      values_.delete();
      return arrarr;
    },
    getArrayArray64: function(func) {
      var sizes = new Module.VectorValue();
      var values_ = new Module.VectorValue();
      func(sizes, values_);

      var arrarr = [];
      var offset = 0;
      for (var i = 0; i < sizes.size(); i++) {
        var size = sizes.get(i);
        var arr = [];
        while (size > 0) {
          arr.push(values_.get(offset));
          arr.push(values_.get(offset + 1));
          offset += 2;
          size--;
        }
        arrarr.push(arr);
      }

      sizes.delete();
      values_.delete();
      return arrarr;
    },

    // SuRF queries
    lookupKey: function(point_query_key) {
      if (this.surf.filter === null) {
        return false;
      } else {
        return this.surf.filter.lookupKey(point_query_key);
      }
    },
    lookupRange: function(range_query_begin_key, range_query_begin_inclusive, range_query_end_key, range_query_end_inclusive) {
      if (this.surf.filter === null) {
        return [false, []];
      } else {
        var keys = [];
        var iter = this.surf.filter.moveToKeyGreaterThan(range_query_begin_key, range_query_begin_inclusive);
        while (iter.isValid()) {
          var compare = iter.compare(range_query_end_key);
          if (compare == Module.surf_kCouldBePositive) {
            // Potentially false positive
          } else if (range_query_end_inclusive) {
            if (!(compare <= 0)) {
              break;
            }
          } else {
            if (!(compare < 0)) {
              break;
            }
          }
          // Avoid using getKey() until it handles all corner cases
          // keys.push(iter.getKey());
          keys.push(range_query_begin_key);
          // Do not continue iteration for now
          break;
          iter.next(1); // 1 is a dummy argument
        }
        iter.delete();
        return [keys.length > 0, keys];
      }
    },

    // Exact queries
    exactLookupKey: function(point_query_key) {
      return this.keys.indexOf(point_query_key) != -1;
    },
    exactLookupRange: function(range_query_begin_key, range_query_begin_inclusive, range_query_end_key, range_query_end_inclusive) {
      var i;
      var keys = [];
      if (range_query_begin_inclusive) {
        for (i = 0; i < this.keys.length; i++) {
          var key = this.keys[i];
          if (key >= range_query_begin_key) {
            break;
          }
        }
      } else {
        for (i = 0; i < this.keys.length; i++) {
          var key = this.keys[i];
          if (key > range_query_begin_key) {
            break;
          }
        }
      }
      while (i < this.keys.length) {
        var key = this.keys[i];
        if (range_query_end_inclusive) {
          if (!(key <= range_query_end_key)) {
            break;
          }
        } else {
          if (!(key < range_query_end_key)) {
            break;
          }
        }
        keys.push(key);
        i++;
      }
      return [keys.length > 0, keys];
    },

    // Suffix labels for each suffix node
    getSuffixLabels: function() {
      var labels = [];
      var suffixes = this.suffixes;
      var suffix_counts = this.suffix_counts;
      var suffix_len = this.actual_suffix_len;
      var suffix_idx = 0;
      var show_letter = this.suffix_type == 'real' && this.suffix_len % 8 == 0;
      for (var index = 0; index < suffixes.length; index++) {
        var array = suffixes[index];
        var text = this.formatBitvectorPartial(array, suffix_counts[index] * suffix_len, suffix_len);
        var level_labels = text.split(' ');
        if (show_letter) {
          level_labels = this.convertBinaryToLetters(level_labels);
        }
        labels.push(level_labels);
      }
      return labels;
    },

    // Node and edge highlighter
    highlightQueryResult: function() {
      var highlight = false;
      var result = false;
      var keys;
      if (this.surf.filter !== null) {
        if (this.query_type == 'point') {
          highlight = true;
          result = this.surf.filter.lookupKey(this.point_query_key);
          keys = [this.point_query_key];
        } else if (this.query_type == 'range') {
          highlight = true;
          var lookup_result = this.lookupRange(this.range_query_begin_key, this.range_query_begin_inclusive, this.range_query_end_key, this.range_query_end_inclusive);
          result = lookup_result[0];
          if (result) {
            // Use keys from exact lookup results for highlighting temporarily
            // keys = lookup_result[1];
            keys = this.exactLookupRange(this.range_query_begin_key, this.range_query_begin_inclusive, this.range_query_end_key, this.range_query_end_inclusive)[1];
          } else {
            keys = [this.range_query_begin_key];
          }
        }
      }

      var full_nodes = this.tree.full_nodes;
      var nodes = JSON.parse(JSON.stringify(this.tree.nodes));
      var edges = JSON.parse(JSON.stringify(this.tree.edges));

      var borderWidth = 5;
      var traversalFont = {
        color: '#FFFFFF'
      };
      var traversalColor = {
        background: '#8080FF',
        hover: {
          background: '#8080FF'
        }
      };
      var successfulArrivalFont = {
        color: '#000000'
      };
      var successfulArrivalColor = {
        background: '#80FF80',
        hover: {
          background: '#80FF80'
        }
      };
      var failedArrivalFont = {
        color: '#FFFFFF'
      };
      var failedArrivalColor = {
        background: '#FF0000',
        hover: {
          background: '#FF0000'
        }
      };

      // Required to correct change updates by vue2vis
      for (i = 0; i < nodes.length; i++) {
        nodes[i].borderWidth = 1;
        nodes[i].font = {
          color: '#000000'
        };
        nodes[i].color = {
          background: '#D2E5FF',
          hover: {
            background: '#D2E5FF'
          }
        };
        // Use initial coordinates that help layout engine order nodes in each level
        // nodes[i].x = nodes[i].id;
        // nodes[i].y = nodes[i].level;
      }
      for (i = 0; i < edges.length; i++) {
        edges[i].width = 1;
      }

      if (highlight) {
        for (var key_idx = 0; key_idx < keys.length; key_idx++) {
          var key = keys[key_idx];

          var node_idx = 0;
          var i;
          for (i = 0; i < key.length; i++) {
            var child = full_nodes[node_idx].children[key[i]];
            if (child !== undefined) {
              nodes[node_idx].borderWidth = borderWidth;
              nodes[node_idx].font = traversalFont;
              nodes[node_idx].color = traversalColor;
              edges[child.edge_idx].width = borderWidth;
              node_idx = child.node_idx;
            } else {
              break;
            }
          }
          if (i == key.length) {
            var child = full_nodes[node_idx].children[Module.surf_kTerminator];
            if (child !== undefined) {
              nodes[node_idx].borderWidth = borderWidth;
              nodes[node_idx].font = traversalFont;
              nodes[node_idx].color = traversalColor;
              edges[child.edge_idx].width = borderWidth;
              node_idx = child.node_idx;
            }
          }
          nodes[node_idx].borderWidth = borderWidth;
          if (result) {
            nodes[node_idx].font = successfulArrivalFont;
            nodes[node_idx].color = successfulArrivalColor;
          } else {
            nodes[node_idx].font = failedArrivalFont;
            nodes[node_idx].color = failedArrivalColor;
          }
        }
      }
      return [nodes, edges];
    }
  }
});

// The Vue app
var app = new Vue({
  el: '#app'
});
