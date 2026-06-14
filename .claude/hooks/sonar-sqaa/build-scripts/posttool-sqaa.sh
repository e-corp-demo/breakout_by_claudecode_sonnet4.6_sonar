#!/bin/bash
if ! command -v sonar &> /dev/null; then
  exit 0
fi
sonar hook claude-post-tool-use --project 'e-corp-demo_breakout_by_claude'
