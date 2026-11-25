# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lesson-zero-anatomy.spec.ts >> Lesson 0 presents the anatomy sequence and isolates its presentation state
- Location: src/tests/e2e/lesson-zero-anatomy.spec.ts:3:1

# Error details

```
Test timeout of 120000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - status
  - main [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - link "View Camera Simulator home" [ref=e8] [cursor=pointer]:
          - /url: /
          - img [ref=e9]
          - generic [ref=e10]: View Camera Simulator
        - generic [ref=e11]:
          - generic [ref=e12]: Lesson 0 — Meet the View Camera
          - generic [ref=e13]: Lesson
        - generic [ref=e14]:
          - link "All Scenes" [ref=e15] [cursor=pointer]:
            - /url: /scenes
          - generic [ref=e16]:
            - text: Language
            - combobox "Language" [ref=e17]:
              - option "English" [selected]
              - option "繁體中文"
      - region "Simulator body" [ref=e18]:
        - main [ref=e19]:
          - generic [ref=e21]:
            - generic [ref=e22]:
              - generic [ref=e23]:
                - generic [ref=e25]: view_in_ar
                - heading "3D Scene" [level=2] [ref=e26]
              - generic [ref=e27]:
                - generic [ref=e29]:
                  - generic [ref=e30]:
                    - button "Reset 3D view" [ref=e31] [cursor=pointer]
                    - group "View Focus" [ref=e32]:
                      - generic [ref=e33]: View Focus
                      - generic [ref=e34]:
                        - button "Scene" [ref=e35] [cursor=pointer]
                        - button "Camera" [pressed] [ref=e36] [cursor=pointer]
                  - generic [ref=e37]:
                    - generic [ref=e38]: Render quality
                    - combobox "Render quality" [ref=e39]:
                      - option "High" [selected]
                      - option "Standard"
                      - option "Low"
                - button "Expand 3D Scene" [ref=e47] [cursor=pointer]:
                  - generic [ref=e48]: open_in_new
            - generic "GroundGlassColumn" [ref=e49]:
              - generic [ref=e50]:
                - generic [ref=e52]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e53]
              - generic [ref=e54]:
                - generic [ref=e56]:
                  - group "Preview" [ref=e57]:
                    - generic [ref=e58]: Preview
                    - generic [ref=e60]:
                      - generic [ref=e61]:
                        - radio "Raw Ground Glass" [checked] [ref=e62]
                        - generic [ref=e63]: Raw Ground Glass
                      - generic [ref=e64]:
                        - radio "Upright Assist" [ref=e65]
                        - generic [ref=e66]: Upright Assist
                  - group "View Options" [ref=e67]:
                    - generic [ref=e68]: View Options
                    - region "View Options" [ref=e70]:
                      - generic [ref=e72]:
                        - checkbox "Grid" [checked] [ref=e73]
                        - generic [ref=e74]: Grid
                - generic "GroundGlassViewport" [ref=e75]:
                  - generic [ref=e77]:
                    - generic [ref=e78]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e79]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 2000.0 mm focus
                      - button "Focus loupe · 4× Ground Glass view" [ref=e83] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e84]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e85] [cursor=pointer]:
                    - generic [ref=e86]: open_in_new
        - complementary [ref=e87]:
          - region "Understanding the Image Circle" [ref=e89]:
            - generic [ref=e90]:
              - paragraph [ref=e91]: Lesson 0 · Meet the View Camera
              - paragraph [ref=e92]: Step 12 of 20
            - generic [ref=e93]:
              - heading "Understanding the Image Circle" [level=3] [ref=e94]
              - paragraph [ref=e95]: Conceptually, finite lens coverage forms a circular Image Circle on a plane perpendicular to the optical axis. The 4×5 film rectangle uses only part of it, leaving spare area around its edges. This is a teaching illustration, not measured coverage data for a particular lens. Front Rise and Front Shift change coverage's position relative to the film rectangle.
              - paragraph [ref=e96]: Compare the 4×5 film rectangle with the larger rose Image Circle around it. The extra area is the movement room used by Rise and Shift.
            - generic [ref=e97]:
              - button "Previous" [ref=e98] [cursor=pointer]
              - button "Next" [active] [ref=e99] [cursor=pointer]
            - generic [ref=e100]:
              - button "Restart lesson" [ref=e101] [cursor=pointer]
              - link "Back to Scenes" [ref=e102] [cursor=pointer]:
                - /url: /scenes
```