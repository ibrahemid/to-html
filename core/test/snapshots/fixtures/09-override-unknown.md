```to-html
{"template":"nonexistent"}
```

# Fallback test

This override names a template that does not exist; the renderer should fall back to prose without crashing.

The fallback path is part of the shipped behavior and must stay byte-stable across the refactor.
