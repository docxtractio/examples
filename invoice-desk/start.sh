#!/bin/sh
# Date: 2026-09-06
# Author: Alok
# File: invoice-desk/start.sh
# Purpose: Launch the local example app.
set -eu
cd "$(dirname "$0")"
exec npm start
