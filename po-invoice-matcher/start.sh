#!/bin/sh
# Date: 2026-09-06
# Author: Alok
# File: po-invoice-matcher/start.sh
# Purpose: Launch the local example app.
set -eu
cd "$(dirname "$0")"
exec php -d post_max_size=16M -d upload_max_filesize=10M -S 127.0.0.1:3103 -t public router.php
