#!/bin/bash
# Extract complete schedule data for a level from NotebookLM
LEVEL=$1
OUTFILE="/home/data/Documents/webapps/provincials-tracker/data/raw/${LEVEL,,}.json"

echo "Extracting $LEVEL..."
notebooklm ask "For $LEVEL level: Give me ALL teams organized by pool, AND all round-robin games, AND all playoff games. Format as JSON: {\"pools\": [{\"id\": \"A\", \"teams\": [{\"number\": 1234, \"name\": \"Team Name\"}]}], \"games\": [{\"game\": 1, \"day\": \"Friday\", \"date\": \"Apr 10\", \"time\": \"8:00 AM\", \"rink\": \"Arena\", \"phase\": \"round-robin\", \"pool\": \"A\", \"home\": 1234, \"away\": 5678}], \"playoffs\": [{\"game\": 99, \"day\": \"Sunday\", \"date\": \"Apr 12\", \"time\": \"10:00 AM\", \"rink\": \"Arena\", \"phase\": \"quarter-final\", \"matchup\": \"1st Pool A vs 1st Pool H\"}]}. Include EVERY team and EVERY game. Do not truncate or summarize - I need the complete data." --json 2>&1 > "$OUTFILE"
echo "Done: $OUTFILE"
