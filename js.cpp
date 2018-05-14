#include <emscripten/bind.h>

#include "../include/surf.hpp"

typedef uint32_t Value;
typedef std::vector<uint32_t> VectorValue;

// Access helper classes that convert 64-bit integers to 32-bit integers
// for compatibility with JavaScript

namespace surf {

class SuRFAccessHelper {
public:
  SuRFAccessHelper(const SuRF& filter) : filter_(filter) {}

  uint32_t serializedSize() const {
    return (uint32_t)filter_.serializedSize();
  }

  uint32_t getMemoryUsage() const {
    return (uint32_t)filter_.getMemoryUsage();
  }

private:
  const SuRF& filter_;
};

class SuRFBuilderAccessHelper {
public:
  SuRFBuilderAccessHelper(const SuRFBuilder& builder) : builder_(builder) {}

  void getBitmapLabels(VectorValue& sizes, VectorValue& values) const {
    copy_nested64(sizes, values, builder_.getBitmapLabels());
  }

  void getBitmapChildIndicatorBits(VectorValue& sizes, VectorValue& values) const {
    copy_nested64(sizes, values, builder_.getBitmapChildIndicatorBits());
  }

  void getPrefixkeyIndicatorBits(VectorValue& sizes, VectorValue& values) const {
    copy_nested64(sizes, values, builder_.getPrefixkeyIndicatorBits());
  }

  void getLabels(VectorValue& sizes, VectorValue& values) const {
    copy_nested(sizes, values, builder_.getLabels());
  }

  void getChildIndicatorBits(VectorValue& sizes, VectorValue& values) const {
    copy_nested64(sizes, values, builder_.getChildIndicatorBits());
  }

  void getLoudsBits(VectorValue& sizes, VectorValue& values) const {
    copy_nested64(sizes, values, builder_.getLoudsBits());
  }

  void getSuffixes(VectorValue& sizes, VectorValue& values) const {
    copy_nested64(sizes, values, builder_.getSuffixes());
  }

  void getSuffixCounts(VectorValue& values) const {
    copy(values, builder_.getSuffixCounts());
  }

  void getNodeCounts(VectorValue& values) const {
    copy(values, builder_.getNodeCounts());
  }

private:
  const SuRFBuilder& builder_;

  template <typename T>
  static void copy(VectorValue& values, const std::vector<T>& vec) {
    values.clear();

    for (auto& value : vec) {
      values.push_back((Value)value);
    }
  }

  template <typename T>
  static void copy_nested(VectorValue& sizes, VectorValue& values, const std::vector<std::vector<T> >& vecvec) {
    sizes.clear();
    values.clear();

    for (auto& vec : vecvec) {
      sizes.push_back((Value)vec.size());

      for (auto& value : vec) {
        values.push_back((Value)value);
      }
    }
  }

  template <typename T>
  static void copy_nested64(VectorValue& sizes, VectorValue& values, const std::vector<std::vector<T> >& vecvec) {
    sizes.clear();
    values.clear();

    for (auto& vec : vecvec) {
      sizes.push_back((Value)vec.size());

      for (auto& value : vec) {
        values.push_back((Value)((uint64_t)value >> 32));
        values.push_back((Value)((uint64_t)value & 0xffffffff));
      }
    }
  }
};

}

// Container bindings

EMSCRIPTEN_BINDINGS(stl_wrappers) {
  emscripten::register_vector<std::string>("VectorString");
}

EMSCRIPTEN_BINDINGS(surf_access_helper_wrappers) {
  emscripten::register_vector<Value>("VectorValue");
}

// SuRF bindings

EMSCRIPTEN_BINDINGS(surf) {
  // config.hpp
  // ==========
  emscripten::constant("surf_kTerminator", surf::kTerminator);

  emscripten::constant("surf_kIncludeDense", surf::kIncludeDense);

  emscripten::constant("surf_kSparseDenseRatio", surf::kSparseDenseRatio);

  emscripten::enum_<surf::SuffixType>("surf_SuffixType")
    .value("kNone", surf::SuffixType::kNone)
    .value("kHash", surf::SuffixType::kHash)
    .value("kReal", surf::SuffixType::kReal)
    .value("kMixed", surf::SuffixType::kMixed)
    ;

  // surf.hpp
  // ========
  emscripten::class_<surf::SuRF>("surf_SuRF")
    .constructor<const std::vector<std::string>, const bool, const uint32_t, const surf::SuffixType, const surf::level_t, const surf::level_t>()
    .function("lookupKey", &surf::SuRF::lookupKey)
    .function("moveToKeyGreaterThan", &surf::SuRF::moveToKeyGreaterThan)
    .function("moveToKeyLessThan", &surf::SuRF::moveToKeyLessThan)
    .function("moveToFirst", &surf::SuRF::moveToFirst)
    .function("moveToLast", &surf::SuRF::moveToLast)
    .function("lookupRange", &surf::SuRF::lookupRange)
    .function("getHeight", &surf::SuRF::getHeight)
    .function("getSparseStartLevel", &surf::SuRF::getSparseStartLevel)
    .function("destroy", &surf::SuRF::destroy)
    ;

  emscripten::class_<surf::SuRF::Iter>("surf_SuRFIter")
    .function("isValid", &surf::SuRF::Iter::isValid)
    .function("compare", &surf::SuRF::Iter::compare)
    .function("getKey", &surf::SuRF::Iter::getKey)
    .function("next", &surf::SuRF::Iter::operator++)
    .function("prev", &surf::SuRF::Iter::operator--)
    ;

  // access helper
  emscripten::class_<surf::SuRFAccessHelper>("surf_SuRFAccessHelper")
    .constructor<const surf::SuRF&>()
    .function("serializedSize", &surf::SuRFAccessHelper::serializedSize)
    .function("getMemoryUsage", &surf::SuRFAccessHelper::getMemoryUsage)
    ;

  // surf_builder.hpp
  // ================
  emscripten::class_<surf::SuRFBuilder>("surf_SuRFBuilder")
    .constructor<bool, uint32_t, surf::SuffixType, surf::level_t, surf::level_t>()
    .function("build", &surf::SuRFBuilder::build)
    .function("getTreeHeight", &surf::SuRFBuilder::getTreeHeight)
    .function("getSparseStartLevel", &surf::SuRFBuilder::getSparseStartLevel)
    .function("getSuffixType", &surf::SuRFBuilder::getSuffixType)
    .function("getSuffixLen", &surf::SuRFBuilder::getSuffixLen)
    .function("getHashSuffixLen", &surf::SuRFBuilder::getHashSuffixLen)
    .function("getRealSuffixLen", &surf::SuRFBuilder::getRealSuffixLen)
    ;

  // access helper
  emscripten::class_<surf::SuRFBuilderAccessHelper>("surf_SuRFBuilderAccessHelper")
    .constructor<const surf::SuRFBuilder&>()
    .function("getBitmapLabels", &surf::SuRFBuilderAccessHelper::getBitmapLabels)
    .function("getBitmapChildIndicatorBits", &surf::SuRFBuilderAccessHelper::getBitmapChildIndicatorBits)
    .function("getPrefixkeyIndicatorBits", &surf::SuRFBuilderAccessHelper::getPrefixkeyIndicatorBits)
    .function("getLabels", &surf::SuRFBuilderAccessHelper::getLabels)
    .function("getChildIndicatorBits", &surf::SuRFBuilderAccessHelper::getChildIndicatorBits)
    .function("getLoudsBits", &surf::SuRFBuilderAccessHelper::getLoudsBits)
    .function("getSuffixes", &surf::SuRFBuilderAccessHelper::getSuffixes)
    .function("getSuffixCounts", &surf::SuRFBuilderAccessHelper::getSuffixCounts)
    .function("getNodeCounts", &surf::SuRFBuilderAccessHelper::getNodeCounts)
    ;
}

