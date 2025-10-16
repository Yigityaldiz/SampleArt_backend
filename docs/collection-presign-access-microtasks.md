# Collection Presign Access Microtasks

- [x] Extend `createPresignedDownloadBodySchema` to require `sampleId` (and optionally `collectionId`) so the backend receives context for shared assets.
- [x] Adjust `UploadService.createPresignedDownload` to permit access for collection members by:
  - [x] Loading the sample via `SampleRepository.findById` and validating the `objectKey`.
  - [x] Performing a membership check with a new `CollectionRepository` helper before issuing the presign.
- [x] Add the new membership helper method to `CollectionRepository` (e.g. `findMembershipForSample`) to support the service logic.
- [x] Consider extracting a reusable `ensureSampleAccess` helper to consolidate access checks shared by uploads and sample read endpoints.
- [x] Update or add automated tests covering owners, admins, authorized collection members, and unauthorized users requesting presigned downloads.
- [x] Coordinate frontend schema updates so clients send the newly required identifiers when requesting download URLs.
