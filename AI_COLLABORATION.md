# AI Collaboration strategy and documentation

## Important notice

This file may not be edited by an AI agent unless the user explicitly requests a formatting or a wording change on this document.

## General plan

After taking an initial look at the reference-backend and reading through the challenge documentation, I decided on this development roadmap.
I've added my own judgement of task complexity as points next to the phases.
Next to quality output, perfromance is the most important metric so the roadmap attempts to reflect this.

- Phase 0: Plan (1 point)
  - Write this general plan
  - Then let claude initialise itself in the repository and iterate on a plan with it (based on this document and the README)
- Phase 1: Basic setup + bootstrap minimal frontend (1 point)
  - Dockerize setup
  - Spin up a simple frontend with React and Tailwind with a working backend connection (no speech to text engine yet)
  - Switch backend to TypeScript and plug a placeholder LLM with an initial prompt into the backend
- Phase 2: Testing and monitoring setup (1 point)
  - Add performance and LLM monitoring (tracking costs, throughput and storing prompts + responses for future analysis)
  - Add E2E testing harness for frontend
  - Add unit testing for backend
- Phase 3: Add speech2text engine (1 point)
  - TBD which engine and where processing resides (I haven't worked with whisper yet - my assumption now is in the backend)
- Phase 4: Find the best suited local LLM and prompt for the sentiment analysis task (2 points)
  - Develop a benchmark for local LLMs using a powerful LLM as the judge for the output
  - Store benchmark results so devs can act as judges too
  - Two-dimensional problem: Changing the prompt will change the output of the model - so the model that performs best on one prompt might not be the best on another prompt. We have to be pragmatic: Start out with a reasonable prompt and pick the best model. If during future development the prompt changes a lot we might need to go back to this step and test the other models with our changed prompt.
- Phase 5: End-to-end verification and performance iterations (2 points)
  - Iteration starts by running benchmark, then manual user tests
  - Compare performance and quality to previous iterations
- Phase 6: Nice to have features (2 points)
  - Polished user interface
  - Diagnostics and maintenance backend

We focus on a minimal and testable MVP that is easy to understand first. Then we try to get as good of a model and prompt as possible so that we can work on optimising the perfromance next. Iterating on quality and performance doesn't have a clear distinction between two phases and they might interleave.

## General workflow with agent

The agent will be required to create a new feature or bugfix branch to work on any task. Each task has a definition of done which includes testing and documentation as required parts.

Project management will reside in the docs/tickets/ directory. It will have an index document containing an up to date list of all tasks with their priority and 5 folders: open, in_progress, blocked, finished and closed

The agent is required to write meaningful commit messages so our version history can be used to understand why changes where made.
More complex reasoning about changes should be documented in the ticket.

The agents manage the tickets themselves and it's my responsibility to check if their contents are correct and if the agents are working on the right things.

For now I'll be working with 1 or 2 agents in parallel at the most, since most steps depend on each other and can't be parallelised.
{edit 03.09.2026 12:24}: I identified that frontend and backend tasks could be run in parallel as long as the contracts are defined, stable and we use fixtures.

Starting out from scratch, I'll let claude spin up a plan from the current state of this repository (including this file) and then iterate on the plan until I feel confident in it. Sometimes this will surface holes in my plan that I hadn't considered yet.
I will also let claude create the GitHub repository since it has my connection for it.

## Initial claude prompt

I'm working on an AI assisted coding challenge for a job interview at the company Echory.

The position I'm applying for is a Senior Full Stack Developer with a heavy focus on realtime processing and work with LLMs.

I've documented the interview process in my knowledge base https://github.com/0x66656c6978/grothkopp - you have private access to my repositories on GitHub, so please go ahead and pull the relevant context. It also includes the most recent email from Pascal about the challenge.

I went ahead and created a folder containing the reference-backend​, the provided README.md​ aswell as my own AI_COLLABORATION.md​

The AI_COLLABORATION.md​ also outlines how you are required to work as an agent - it outlines testing, validation and project management.

Your first task is to iterate on a plan with me, defining the project roadmap (considering the time, latency and quality constraints).

There is no repository for this project on my GitHub yet, so please create a remote repository and push the initial changes.

## Collaboration on the initial plan

Claude was confused about the timeframe assuming it's only 2 days and wanted to compress the roadmap as such, which I denied.
Claude offered to use only remote free-tier models stating the additional risk of adding our own model - I declined.
Asked if we should have a live demo runs a scripted chunk-streaming simulator - I said yes if we have time in the end. A few handpicked examples should be enough since the judges are going to run their own test set against our API anyways.

Asked if we really need STT and made me reconsider my choice from before - Opting out unless generating the test data is becoming too complex.

After we decided on a plan, I let claude create all tickets for the future from the existing knowledge.

For the initial project setup and the first two phases I expect smooth sailing.

## Working on the features

Letting claude analyse the dependency graph between the tickets, we identified a few zero-dependency tasks and false dependencies where work can be parallelised. Claude offered to kick off multiple sub-agents. I required it to run the agents with their own git worktree and so it offered to switch `isolation` to `"worktree"` - a feature I didn't know about before that gives each agent its own working tree. The caveat here is that both branch from master and if the contract changes between master and what an agent works on we'd have a real merge conflict - won't be a problem if we harden the contracts first.
This `isolation` feature did not work though since the harness was initialized without a git repository. It tried to create sub-directories for the agents but I stopped it - not parallelising work for now since it's costing more time than expected.

## Issues

### Dockerizing the setup

When I looked over claude's plan I did not see that it took the step to dockerise the project out - its reason was that in the challenge instructions there was no mention of Docker anywhere - it silently just took this part out. After asking about it when claude worked on the first ticket, it realised its mistake and asked how to add it back. I realised I should have clarified this with Pascal before I started, but I'm being pragmatic since there's no answer yet and assuming that Docker will be okay.

### Context window

Working in the same session with claude will make it slower and slower. It's a trade off - telling claude to work on the next feature in the same session allows it to access all previous context - but at the cost of running and thinking for longer.
I'm opting to let claude generate a prompt for me that I can paste in new sessions to kick off work on new issues. The prompt gives the agent all the information to find its context fast in the documentation. I'm using this prompt starting from Phase 2.
