#!/bin/sh
set -eu

mkdir -p build/native
swiftc swift/OpenWhispHelper.swift -o build/native/openwhisp-helper
