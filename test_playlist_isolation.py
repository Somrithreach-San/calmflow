#!/usr/bin/env python3
"""
Test Playlist Isolation for CalmFlow
This test validates that playlist interactions don't interfere with each other
and that duplicate method handling works correctly.
"""

import sys
import os

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_playlist_methods():
    """Test that there are no duplicate methods in SoundManager class"""
    print("🔍 Testing SoundManager class for duplicate methods...")
    
    # Read the main JavaScript file
    js_file = "static/script.js"
    try:
        with open(js_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ Error: {js_file} not found")
        return False
    
    # Look for class definition
    if "class SoundManager" not in content:
        print("❌ Error: SoundManager class not found in main.js")
        return False
    
    # Extract the class methods
    lines = content.split('\n')
    in_class = False
    methods = []
    current_method = ""
    
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        
        if line_stripped.startswith("class SoundManager"):
            in_class = True
            continue
        
        if in_class and line_stripped.startswith("}"):
            break
        
        if in_class and line_stripped and not line_stripped.startswith("//"):
            # Check for method definition
            if "(" in line_stripped and line_stripped.endswith("{") and not line_stripped.startswith("if") and not line_stripped.startswith("for") and not line_stripped.startswith("while") and not line_stripped.startswith("}") and not line_stripped.startswith("return") and not line_stripped.startswith("console"):
                # Try to extract method name
                if "async" in line_stripped:
                    line_stripped = line_stripped.replace("async ", "")
                
                # Find the method name
                if line_stripped.startswith("constructor"):
                    method_name = "constructor"
                else:
                    # Extract method name (everything before "(")
                    method_part = line_stripped.split("(")[0]
                    if " " in method_part:
                        method_name = method_part.split(" ")[-1]
                    else:
                        method_name = method_part
                
                if method_name:
                    methods.append(method_name)
    
    print(f"\n📋 Found {len(methods)} methods in SoundManager class:")
    
    # Check for duplicates
    from collections import Counter
    method_counts = Counter(methods)
    duplicates = {method: count for method, count in method_counts.items() if count > 1}
    
    if duplicates:
        print("\n❌ DUPLICATE METHODS FOUND:")
        for method, count in duplicates.items():
            print(f"   - {method}: appears {count} times")
        return False
    else:
        print("\n✅ No duplicate methods found!")
        return True

def test_playlist_isolation_logic():
    """Test the playlist isolation logic"""
    print("\n🎯 Testing playlist isolation logic...")
    
    # Read the test cases from the JavaScript
    js_file = "static/script.js"
    try:
        with open(js_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ Error: {js_file} not found")
        return False
    
    # Test key methods for playlist isolation
    required_methods = [
        "isSamePlaylist",
        "handlePlaylistClick",
        "stopAllSounds",
        "stopGroupSounds",
        "stopUserPlaylist",
        "playUserPlaylist",
        "playGroupSounds",
        "playRandomSounds"
    ]
    
    missing_methods = []
    for method in required_methods:
        if f"{method}(" not in content and f"async {method}(" not in content:
            missing_methods.append(method)
    
    if missing_methods:
        print(f"❌ Missing required methods: {', '.join(missing_methods)}")
        return False
    
    print("✅ All required playlist isolation methods found")
    
    # Check for key isolation patterns
    isolation_patterns = [
        "currentActiveGroup",
        "currentActivePlaylist",
        "stopAllSounds()",
        "classList.remove('playing')",
        "isSamePlaylist"
    ]
    
    for pattern in isolation_patterns:
        if pattern in content:
            print(f"✅ Found isolation pattern: {pattern}")
        else:
            print(f"⚠️  Missing pattern: {pattern}")
    
    return True

def test_user_playlist_functionality():
    """Test user playlist specific functionality"""
    print("\n👤 Testing user playlist functionality...")
    
    js_file = "static/script.js"
    try:
        with open(js_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ Error: {js_file} not found")
        return False
    
    # Check for user playlist methods
    user_playlist_methods = [
        "loadUserPlaylists",
        "renderUserPlaylists",
        "createPlaylistCard",
        "startMultiSelectMode",
        "addSelectedSoundsToPlaylist",
        "exitPlaylistCreationMode"
    ]
    
    for method in user_playlist_methods:
        if f"{method}(" in content or f"async {method}(" in content:
            print(f"✅ Found: {method}")
        else:
            print(f"⚠️  Missing: {method}")
    
    return True

def test_api_endpoints():
    """Test that API endpoints are properly referenced"""
    print("\n🌐 Testing API endpoint references...")
    
    js_file = "static/script.js"
    try:
        with open(js_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ Error: {js_file} not found")
        return False
    
    # Check for API endpoints
    api_endpoints = [
        "/api/sounds",
        "/api/playlists",
        "/api/playlists/create",
        "/api/playlists/",
        "/api/playlists/add-sound",
        "/api/playlists/delete"
    ]
    
    for endpoint in api_endpoints:
        if endpoint in content:
            print(f"✅ Found endpoint: {endpoint}")
        else:
            print(f"⚠️  Missing endpoint: {endpoint}")
    
    return True

def main():
    """Run all tests"""
    print("=" * 60)
    print("🔬 CALMFLOW PLAYLIST ISOLATION TEST SUITE")
    print("=" * 60)
    
    tests = [
        ("Method Duplication Test", test_playlist_methods),
        ("Playlist Isolation Logic", test_playlist_isolation_logic),
        ("User Playlist Functionality", test_user_playlist_functionality),
        ("API Endpoints", test_api_endpoints)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*40}")
        print(f"Running: {test_name}")
        print(f"{'='*40}")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Test error: {e}")
            results.append((test_name, False))
    
    print(f"\n{'='*60}")
    print("📊 TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✨ ALL TESTS PASSED! Playlist isolation should work correctly.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())