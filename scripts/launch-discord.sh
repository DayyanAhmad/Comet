#!/bin/bash
# Launch Discord detached from this process
nohup discord > /dev/null 2>&1 &
disown
exit 0
