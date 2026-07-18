# UI and Task Checklist

## Controls

- label is accessible
- min, max, and step are shared constants where appropriate
- keyboard movement lands on public values
- display and canonical state remain synchronized
- disabled reason is visible
- reset and restart are distinct and correct

## Routes and catalog

- scene exists
- public availability is correct
- free mode is supported
- guided mode and guidedTaskId appear together
- task exists and belongs to the scene
- invalid route redirects before workspace initialization
- card links match the route contract

## Guided task

- initial state is explicit
- enabled controls are minimal
- signed movement criterion is correct
- raw calibration and UI solution are separate
- all criteria have feedback
- task can be completed through real controls
- restart returns the declared state

## Dialogs and overlays

- accessible name
- modal semantics when modal
- initial focus
- focus containment
- Escape
- focus restoration
- route-change behavior
- viewport bounds
- stable resize behavior
- no content-obscuring overlay at 1024px

## Tests

- unit: pure validation and keyboard logic
- integration: route/workspace state and focus behavior
- E2E: public navigation and actual user interaction
- avoid DOM injection when claiming user reachability
