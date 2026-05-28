# Title <script>alert(1)</script>

Body paragraph with <script>x</script> tags inline, plus a sneaky <img src="x" onerror="alert(1)"> attribute. The sanitizer must escape every angle bracket and strip dangerous attributes; none of these payloads may appear executable in the output.

More content so the gate accepts the reply for rendering.
