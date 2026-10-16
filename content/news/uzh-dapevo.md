---
kind: "link"
title: "UZH keeps visual tracking running when camera frames drop out"
subtitle: |-
    UZH researchers developed DAPEVO to estimate camera motion from conventional images and asynchronous event-camera measurements.
    It tracks corresponding patches in both inputs separately, then uses a learned gate to combine their evidence before refining the motion estimate.
    Event-only observations allow tracking to continue between sparse or unavailable conventional frames.

    On the UZH-FPV benchmark, retaining only one in six conventional frames increased DAPEVO's mean absolute trajectory error from 1.00 to 1.36 metres.
    In the same experiment, errors for the DPVO and RAMP-VO comparison methods rose by factors of 3.7 and 3.1 respectively.
    These are reported benchmark results from a research preprint, not evidence of a deployed navigation system or uninterrupted tracking under all camera failures.
date: "2026-09-25"
url: "https://arxiv.org/abs/2609.30947"
authors: []
organisations: ["uzh"]
topics: ["computer-vision", "robotics"]
image: "https://zurich.tech/news/dapevo.webp"
caption: "Image: Luca Gandolfi and co-authors / UZH Robotics and Perception Group"
---
