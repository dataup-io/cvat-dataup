// Copyright (C) 2019-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

const config = {
    backendAPI: '/api',
    backendDataUP: "http://localhost:8001/api/v1",
    // backendDataUP: "https://api.data-up.io/api/v1",
    organization: {
        organizationID: null,
        organizationSlug: null,
        organizationUuid: null,
        active: false,
    },
    origin: '',
    uploadChunkSize: 100,
    removeUnderlyingMaskPixels: {
        enabled: false,
        onEmptyMaskOccurrence: null,
    },
    onOrganizationChange: null,
    globalObjectsCounter: 0,

    requestsStatusDelay: null,

    jobMetaDataReloadPeriod: 1 * 60 * 60 * 1000, // 1 hour
};

export default config;
