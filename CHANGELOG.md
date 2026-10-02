# Changelog

## [1.2.0](https://github.com/Vadymk95/template-next-seo/compare/v1.1.3...v1.2.0) (2026-10-02)


### Features

* **agents:** committed limits deny force pushes, skipped hooks and env reads in every mode ([c32df99](https://github.com/Vadymk95/template-next-seo/commit/c32df9941992a0440aca2adc89b6feac1c0ee184))


### Bug fixes

* **deps:** next 16.3.6+ for GHSA-vcvr-r3jv-pc5j and a raised brace-expansion floor ([9cf441c](https://github.com/Vadymk95/template-next-seo/commit/9cf441c2920fd5029a723ad605c4723afe1a37ec))


### Maintenance

* **deps:** bump the minor-and-patch group across 1 directory with 15 updates ([#91](https://github.com/Vadymk95/template-next-seo/issues/91)) ([98c5271](https://github.com/Vadymk95/template-next-seo/commit/98c527159c839e2acf9fe969c8b18455c0fffc0b))
* **gate:** cap e2e failures on the gate run and keep one last-run record per suite ([3bdfc64](https://github.com/Vadymk95/template-next-seo/commit/3bdfc649a6a6164b6910415b66565913b04112bb))


### Documentation

* **brain:** the sibling templates' vitest 5 mutation runs were red, not killing mutants ([48f68a5](https://github.com/Vadymk95/template-next-seo/commit/48f68a58674974b2e738b10e7aac65144ccfc6fb))


### CI

* **deps:** one weekly Dependabot PR for minor and patch, so the lock file stops conflicting ([9d1aeef](https://github.com/Vadymk95/template-next-seo/commit/9d1aeefd7a26e6f4098fa442d36a0cc814b62617))
* **release:** release-please prefers a RELEASE_PLEASE_TOKEN secret when one is set ([a05de4b](https://github.com/Vadymk95/template-next-seo/commit/a05de4ba0a6bdbb9b405d36befbef6e51a2a5cea))

## [1.1.3](https://github.com/Vadymk95/template-next-seo/compare/v1.1.2...v1.1.3) (2026-09-27)


### Maintenance

* **deps:** bump the development-dependencies group with 6 updates ([#83](https://github.com/Vadymk95/template-next-seo/issues/83)) ([084b588](https://github.com/Vadymk95/template-next-seo/commit/084b588d1e0a57e850ed0ba60e74aee6176316da))
* **deps:** bump the production-dependencies group with 5 updates ([#82](https://github.com/Vadymk95/template-next-seo/issues/82)) ([1379907](https://github.com/Vadymk95/template-next-seo/commit/1379907c3e6f8357a2ab3a9780f4f516014c84e0))


### Documentation

* **agents:** trim the stack table and the incident stories told twice ([#84](https://github.com/Vadymk95/template-next-seo/issues/84)) ([d6383eb](https://github.com/Vadymk95/template-next-seo/commit/d6383eb00c113a04427ca61c67dd6b6724dd1333))


### CI

* **deps:** bump googleapis/release-please-action in the actions group ([#81](https://github.com/Vadymk95/template-next-seo/issues/81)) ([ccadb9c](https://github.com/Vadymk95/template-next-seo/commit/ccadb9c302df101ff0c0f03f34a09fc0e769d574))

## [1.1.2](https://github.com/Vadymk95/template-next-seo/compare/v1.1.1...v1.1.2) (2026-09-13)


### Bug fixes

* **ci:** a fork that renames its default branch no longer loses CI and protection ([#79](https://github.com/Vadymk95/template-next-seo/issues/79)) ([44517a1](https://github.com/Vadymk95/template-next-seo/commit/44517a1354fd7c90294803477492260026c9d0c2))

## [1.1.1](https://github.com/Vadymk95/template-next-seo/compare/v1.1.0...v1.1.1) (2026-09-13)


### Bug fixes

* **docs:** restore two sections a careless span edit deleted from AGENTS.md ([#78](https://github.com/Vadymk95/template-next-seo/issues/78)) ([9f44ef2](https://github.com/Vadymk95/template-next-seo/commit/9f44ef2472ad9990aef8be456f1423817e4e8a55))
* **gate:** give the push budget a recency window so it can recover ([ff32dc3](https://github.com/Vadymk95/template-next-seo/commit/ff32dc32736bb85dbea6f4d76f03b00dbb0c79b0))
* **gate:** let release-please own the changelog format instead of the checker ([21691ba](https://github.com/Vadymk95/template-next-seo/commit/21691ba29a8cc9ecbe2efe7986de021eb6dc1578))
* **gate:** make vitest and eslint blind to an agent worktree inside the repo ([5ed74f4](https://github.com/Vadymk95/template-next-seo/commit/5ed74f47c50affe06e29999ce493b0bf08f6f8b3))
* **gate:** the push budget calibrates to the machine it runs on, not to mine ([#77](https://github.com/Vadymk95/template-next-seo/issues/77)) ([d1fc901](https://github.com/Vadymk95/template-next-seo/commit/d1fc901fdee3fd1c806ec6813c3a2a4fe1c476fa))


### Documentation

* **gate:** record why the push budget is not raised on today's window reading ([cfe602d](https://github.com/Vadymk95/template-next-seo/commit/cfe602d4c1098b1299f99e2cf75f54bc7d5971bf))

## [1.1.0](https://github.com/Vadymk95/template-next-seo/compare/v1.0.0...v1.1.0) (2026-09-13)


### Features

* **docs-check:** focused tests never land; an unconditional skip carries a dated quarantine ([544671d](https://github.com/Vadymk95/template-next-seo/commit/544671d206d38e51737b3d6511b300abc1f71a3b))
* **gate:** docs:check in a docs class; the tracer records the phase ([1db84a6](https://github.com/Vadymk95/template-next-seo/commit/1db84a6bfb26887ed51572939db3d3d6b7dfb544))
* **gate:** the browser suite has a ceiling in the tier data; push budgets are per phase ([a07dc5c](https://github.com/Vadymk95/template-next-seo/commit/a07dc5c80b0cda966d29eb24d342d82157c2a94c))
* **home:** the start page shows what is inside, how work flows and the agent commands ([d619d2f](https://github.com/Vadymk95/template-next-seo/commit/d619d2f330d487298feda6debfbfb7358cb1863c))


### Bug fixes

* **docs-check:** module references, attached rules, script families; verify:* in the law ([bfa4206](https://github.com/Vadymk95/template-next-seo/commit/bfa4206f46fb24a869991c4fdb0dbe51ec13c258))
* **home:** code chips keep their own foreground, contrast inside muted copy ([307f861](https://github.com/Vadymk95/template-next-seo/commit/307f86161558473199670bb8f02f3714f3576d92))
* **layout:** the scrollbar keeps its gutter, no shift between scrolling and short routes ([1598563](https://github.com/Vadymk95/template-next-seo/commit/15985634094872928dfa3238a90655c9149ba0a8))
* **ports:** the probe answers what its callers ask, IPv6 loopback included ([83d6661](https://github.com/Vadymk95/template-next-seo/commit/83d66619150b03eff68ccd0184f458648fa91151))


### Maintenance

* **deps:** in-range update; the 3-day cooldown lifted once by operator decision ([dc7b03e](https://github.com/Vadymk95/template-next-seo/commit/dc7b03e6cff87afe2696e89fa97530835f3e284d))
* **hooks:** the pre-push remedy no longer tells a human to run heavy stages by hand ([c95a413](https://github.com/Vadymk95/template-next-seo/commit/c95a41391d678601b2b530e41de1d3b1a845d26e))


### Tests

* **gate:** run-on-free-port reads the announced port; the base+1 case was flaky ([d3dace3](https://github.com/Vadymk95/template-next-seo/commit/d3dace3060d463470abdb31ad6de649e91926390))


### CI

* **release:** release-please keeps a release PR with the version, changelog and tag ([a0d7930](https://github.com/Vadymk95/template-next-seo/commit/a0d793077330d15b9cb87d709b2f6df717f5e7a9))
