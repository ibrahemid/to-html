# Pipeline Overview

This reply describes a small data pipeline with several stages and enough body
text to pass the render gate. The input arrives, gets processed, and an output
is produced. Each stage is independent and testable on its own.

## Input

The input stage validates and normalizes incoming records.

## Process

The process stage transforms records and enriches them.

## Output

The output stage serializes the result and returns it to the caller.
