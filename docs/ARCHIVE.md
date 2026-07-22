# Match History Archival Protocol

WordPot archives completed match results to keep active server memory lean while maintaining historical accuracy.

## Archival Strategy
* Match logs are pushed to persistent JSON storage after room settlement.
* Expired lobbies with no player joins are purged after 24 hours.
