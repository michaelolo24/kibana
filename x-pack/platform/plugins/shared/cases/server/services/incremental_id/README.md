## Cases Incremental ID Service


1. Add `incremental_id` field to case
2. Initialize .kibana-case-incremental-id-{space} indices
3. Create Task Manager
    - Based on the space on the case SO
    - Retrieve last number for that space, and apply it to the new field
    - Save the saved object
4. 