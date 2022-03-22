# supportyourlocal.band

What would a local band need?

## Key Features

### MVP

OK, the "Minimal Work from Me" version is still too much work to get started. I think a static site is the best first step. (And maybe the best overall as well.) Just base it off of our current site.

* Mobile-first design
* Home page with sections
* EPK
* Gigs / Previous gigs
* Contact information

### Minimal Work from Me

Face it, if this takes a lot of my time I won't do it. I'm happy to add features and do basic tech support, but **all** of the administration needs to be done by the bands.

### Email

Managing an email list and sending out newsletters and updates is something that I have not found a source I like for yet. This is the key feature.

### Song List

This will not only be a source of information for their home page, but will fuel set list creation. Data should include song title, artist, link (or links) to audio, duration, and flags for featured and mothballed.

### External Links

This site is meant to be a central location. You can upgrade (or downgrade) your site to paid/self-hosted at any time without penalty or hassle. (If you wanted a custom domain, for instance.) Everything else can be linked to.

### Style Guide

It will make style guides easy and fun! Home pages and emails will use templates that will apply the styles automatically. This is the real killer feature.

### The Rest

I think we need a way to post gigs. This should be easy and be an alternative to Facebook events. Maybe for ease we can integrate with Facebook events to automatically pull stuff in. Or not. This should include venue information.

Fan accounts. Like/follow bands. Write "reviews"

## Monitization

If you want a custom domain, it'll cost you $100 a year and we'll manage it. Plus, I don't know, white glove customer service? Maybe add a few other perks.

Advertise for local venues and bands.

# Architecture

It'd be nice to be able to pull latest and have it be back-compatible. (All differences come from the data, and maybe env files.)

Make all sites https

Each has it's own user management (for admin purposes) Reset password with local node util.

## Features for next version

Get user management in a reasonable state

* Put an admin key in the .env file
* Allow owner to add managers/band members
* List users
* Change password
* Change user information
* Reset another user's password

Initial setup (create user and password with a token, direct to band data)

Choose fonts

Image upload and selection

Albums (Need for B&B to adopt framework)
