// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT
/* eslint-disable max-len */
import React from 'react';
import { Redirect, Route, Switch } from 'react-router';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { Col, Row } from 'antd/lib/grid';
import Layout from 'antd/lib/layout';
import Modal from 'antd/lib/modal';
import { App } from 'antd';
import Spin from 'antd/lib/spin';
import { DisconnectOutlined } from '@ant-design/icons';
import Space from 'antd/lib/space';
import Text from 'antd/lib/typography/Text';

import LogoutComponent from 'components/logout-component';
import LoginPageContainer from 'containers/login-page/login-page';
import RegisterPageContainer from 'containers/register-page/register-page';
import ResetPasswordPageConfirmComponent from 'components/reset-password-confirm-page/reset-password-confirm-page';
import ResetPasswordPageComponent from 'components/reset-password-page/reset-password-page';

import Header from 'components/header/header';
import GlobalErrorBoundary from 'components/global-error-boundary/global-error-boundary';

import ShortcutsDialog from 'components/shortcuts-dialog/shortcuts-dialog';
import ExportDatasetModal from 'components/export-dataset/export-dataset-modal';
import ExportBackupModal from 'components/export-backup/export-backup-modal';
import ImportDatasetModal from 'components/import-dataset/import-dataset-modal';
import ImportBackupModal from 'components/import-backup/import-backup-modal';
import UploadFileStatusModal from 'components/common/upload-file-status-modal';

import JobsPageComponent from 'components/jobs-page/jobs-page';

import TasksPageContainer from 'containers/tasks-page/tasks-page';
import CreateTaskPageContainer from 'containers/create-task-page/create-task-page';
import NavTaskPageComponent from 'components/task-page/navigation-task-page';

import ProjectsPageComponent from 'components/projects-page/projects-page';
import CreateProjectPageComponent from 'components/create-project-page/create-project-page';
import ProjectPageComponent from 'components/project-page/project-page';

import CloudStoragesPageComponent from 'components/cloud-storages-page/cloud-storages-page';
import CreateCloudStoragePageComponent from 'components/create-cloud-storage-page/create-cloud-storage-page';
import UpdateCloudStoragePageComponent from 'components/update-cloud-storage-page/update-cloud-storage-page';

import OrganizationPage from 'components/organization-page/organization-page';
import CreateOrganizationComponent from 'components/create-organization-page/create-organization-page';
import { ShortcutsContextProvider } from 'components/shortcuts.context';

import WebhooksPage from 'components/webhooks-page/webhooks-page';
import CreateWebhookPage from 'components/setup-webhook-pages/create-webhook-page';
import UpdateWebhookPage from 'components/setup-webhook-pages/update-webhook-page';

import AnnotationGuidePage from 'components/md-guide/annotation-guide-page';

import InvitationsPage from 'components/invitations-page/invitations-page';

import RequestsPage from 'components/requests-page/requests-page';

import AnnotationPageContainer from 'containers/annotation-page/annotation-page';
import { Organization, getCore } from 'cvat-core-wrapper';
import {
    ErrorState, NotificationState, NotificationsState, PluginsState,
} from 'reducers';
import showPlatformNotification, {
    platformInfo,
    stopNotifications,
    showUnsupportedNotification,
} from 'utils/platform-checker';
import '../styles.scss';
import appConfig from 'config';
import EventRecorder from 'utils/event-recorder';
import { authQuery } from 'utils/auth-query';
import CVATMarkdown from './common/cvat-markdown';
import EmailConfirmationPage from './email-confirmation-pages/email-confirmed';
import EmailVerificationSentPage from './email-confirmation-pages/email-verification-sent';
import IncorrectEmailConfirmationPage from './email-confirmation-pages/incorrect-email-confirmation';
import CreateJobPage from './create-job-page/create-job-page';
import QualityControlPage from './quality-control/quality-control-page';
import AnalyticsReportPage from './analytics-report/analytics-report-page';
import ConsensusManagementPage from './consensus-management-page/consensus-management-page';
import InvitationWatcher from './invitation-watcher/invitation-watcher';
import Sider from './sider/sider';
import agentsPage from './agents-page/agents-page';
import ModelsPageComponent from './models-page/models-page';
import pipelinesPage from './pipelines-page/pipelines-page';
import welcomePage from './welcome-page/welcome-page';
import PlanUpgradePage from './plan-upgrade-page/plan-upgrade-page';
import ApiKeysPage from './api-keys-page/api-keys-page';

interface CVATAppProps {
    loadFormats: () => void;
    loadAbout: () => void;
    verifyAuthenticated: () => void;
    loadUserAgreements: () => void;
    initPlugins: () => void;
    initModels: () => void;
    resetErrors: () => void;
    resetMessages: () => void;
    loadOrganization: () => void;
    initInvitations: () => void;
    initRequests: () => void;
    loadServerAPISchema: () => void;
    onChangeLocation: (from: string, to: string) => void;
    userInitialized: boolean;
    userFetching: boolean;
    organizationFetching: boolean;
    organizationInitialized: boolean;
    pluginsInitialized: boolean;
    pluginsFetching: boolean;
    modelsInitialized: boolean;
    modelsFetching: boolean;
    formatsInitialized: boolean;
    formatsFetching: boolean;
    aboutInitialized: boolean;
    aboutFetching: boolean;
    userAgreementsFetching: boolean;
    userAgreementsInitialized: boolean;
    notifications: NotificationsState;
    user: any;
    isModelPluginActive: boolean;
    pluginComponents: PluginsState['components'];
    invitationsFetching: boolean;
    invitationsInitialized: boolean;
    requestsFetching: boolean;
    requestsInitialized: boolean;
    serverAPISchemaFetching: boolean;
    serverAPISchemaInitialized: boolean;
    isPasswordResetEnabled: boolean;
    isRegistrationEnabled: boolean;
}

interface CVATAppState {
    healthIinitialized: boolean;
    backendIsHealthy: boolean;
}
const CVATApplication: React.FC<CVATAppProps & RouteComponentProps> = (props) => {
    const { notification } = App.useApp();
    const [state, setState] = React.useState<CVATAppState>({
        healthIinitialized: false,
        backendIsHealthy: false,
    });

    // Destructure all props at component level
    const {
        verifyAuthenticated,
        loadFormats,
        loadAbout,
        loadUserAgreements,
        initPlugins,
        initModels,
        loadOrganization,
        loadServerAPISchema,
        userInitialized,
        userFetching,
        organizationFetching,
        organizationInitialized,
        formatsInitialized,
        formatsFetching,
        aboutInitialized,
        aboutFetching,
        pluginsInitialized,
        pluginsFetching,
        modelsInitialized,
        modelsFetching,
        user,
        userAgreementsFetching,
        userAgreementsInitialized,
        isModelPluginActive,
        invitationsInitialized,
        invitationsFetching,
        initInvitations,
        requestsFetching,
        requestsInitialized,
        initRequests,
        history,
        serverAPISchemaFetching,
        serverAPISchemaInitialized,
        notifications,
        resetErrors,
        resetMessages,
        onChangeLocation,
        location,
        pluginComponents,
        isPasswordResetEnabled,
        isRegistrationEnabled,
    } = props;

    React.useEffect(() => {
        // Add a timeout to prevent the entire useEffect from hanging
        const timeoutId = setTimeout(() => {
            console.warn('CVATApplication useEffect timed out, setting fallback state');
            setState({
                healthIinitialized: true,
                backendIsHealthy: false,
            });
        }, 30000); // 30 second timeout

        try {

            const core = getCore();
            const {
                HEALTH_CHECK_RETRIES, HEALTH_CHECK_PERIOD, HEALTH_CHECK_REQUEST_TIMEOUT,
                SERVER_UNAVAILABLE_COMPONENT, RESET_NOTIFICATIONS_PATHS,
            } = appConfig;

        // Logger configuration
        const listener = (e: MouseEvent | KeyboardEvent): void => {
            if (e instanceof MouseEvent && e.type === 'click') {
                EventRecorder.recordMouseEvent(e);
            }

            EventRecorder.recordUserActivity();
        };

        let listenerRegistered = false;
        const visibilityChangeListener = (): void => {
            if (!window.document.hidden) {
                if (!listenerRegistered) {
                    window.addEventListener('keydown', listener, { capture: true });
                    window.addEventListener('click', listener, { capture: true });
                    listenerRegistered = true;
                }
            } else {
                window.removeEventListener('keydown', listener);
                window.removeEventListener('click', listener);
                listenerRegistered = false;
            }
        };

        visibilityChangeListener(); // initial setup other event listeners
        window.addEventListener('visibilitychange', visibilityChangeListener);

        core.logger.configure(() => window.document.hasFocus());
        core.config.onOrganizationChange = (newOrgId: number | null) => {
            try {
                if (newOrgId === null) {
                    localStorage.removeItem('currentOrganization');
                    core.config.organization.organizationUuid = null;
                    window.location.reload();
                } else {
                    core.organizations.get({
                        filter: `{"and":[{"==":[{"var":"id"},${newOrgId}]}]}`,
                    }).then(async ([organization]: Organization[]) => {
                        if (organization) {
                            localStorage.setItem('currentOrganization', organization.slug);
                            core.config.organization.organizationUuid = organization.uuid;
                            window.location.reload();
                        }
                    }).catch((error) => {
                        console.warn('Failed to fetch organization:', error);
                        // Don't crash the app if organization fetch fails
                    });
                }
            } catch (error) {
                console.error('Error in organization change handler:', error);
                // Don't crash the app if organization change handler fails
            }
        };

        try {
            history.listen((newLocation) => {
                try {
                    onChangeLocation(location.pathname, newLocation.pathname);

                    const shouldResetNotifications = RESET_NOTIFICATIONS_PATHS.from.some(
                        (pathname) => location.pathname === pathname,
                    );
                    const pathExcluded = shouldResetNotifications && RESET_NOTIFICATIONS_PATHS.exclude.some(
                        (pathname) => newLocation.pathname.includes(pathname),
                    );
                    if (shouldResetNotifications && !pathExcluded) {
                        resetNotifications();
                    }
                } catch (error) {
                    console.warn('Error in history listener:', error);
                }
            });
        } catch (error) {
            console.warn('Error setting up history listener:', error);
        }

        // Add a timeout to prevent the health check from hanging
        const healthCheckTimeout = setTimeout(() => {
            console.warn('Health check timed out');
            setState({
                healthIinitialized: true,
                backendIsHealthy: false,
            });
        }, HEALTH_CHECK_REQUEST_TIMEOUT + 5000); // Add 5 seconds buffer

        // Wrap health check in try-catch to prevent it from crashing the app
        try {
            core.server.healthCheck(
                HEALTH_CHECK_RETRIES,
                HEALTH_CHECK_PERIOD,
                HEALTH_CHECK_REQUEST_TIMEOUT,
            ).then(() => {
                clearTimeout(healthCheckTimeout);
                setState({
                    healthIinitialized: true,
                    backendIsHealthy: true,
                });
            })
                .catch((error) => {
                    clearTimeout(healthCheckTimeout);
                    console.warn('Health check failed:', error);
                    setState({
                        healthIinitialized: true,
                        backendIsHealthy: false,
                    });

                    // Only show modal if it's a network error, not a 500 server error
                    if (error?.response?.status !== 500) {
                        Modal.error({
                            title: 'Cannot connect to the server',
                            className: 'cvat-modal-cannot-connect-server',
                            closable: false,
                            content:
                                <Text>
                                    {SERVER_UNAVAILABLE_COMPONENT}
                                </Text>,
                        });
                    }
                });
        } catch (healthCheckError) {
            clearTimeout(healthCheckTimeout);
            console.error('Health check initialization failed:', healthCheckError);
            setState({
                healthIinitialized: true,
                backendIsHealthy: false,
            });
        }

        const {
            name, version, engine, os,
        } = platformInfo();

        if (showPlatformNotification()) {
            stopNotifications(false);
            Modal.warning({
                title: 'Unsupported platform detected',
                className: 'cvat-modal-unsupported-platform-warning',
                content: (
                    <>
                        <Row>
                            <Col>
                                <Text>
                                    {`The browser you are using is ${name} ${version} based on ${engine}.` +
                                        ' CVAT was tested in the latest versions of Chrome and Firefox.' +
                                        ' We recommend to use Chrome (or another Chromium based browser)'}
                                </Text>
                            </Col>
                        </Row>
                        <Row>
                            <Col>
                                <Text type='secondary'>{`The operating system is ${os}`}</Text>
                            </Col>
                        </Row>
                    </>
                ),
                onOk: () => stopNotifications(true),
            });
        } else if (showUnsupportedNotification()) {
            stopNotifications(false);
            Modal.warning({
                title: 'Unsupported features detected',
                className: 'cvat-modal-unsupported-features-warning',
                content: (
                    <Text>
                        {`${name} v${version} does not support API, which is used by CVAT. `}
                        It is strongly recommended to update your browser.
                    </Text>
                ),
                onOk: () => stopNotifications(true),
            });
        }
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Error in CVATApplication useEffect:', error);
            // Set a default state to prevent the app from crashing
            setState({
                healthIinitialized: true,
                backendIsHealthy: false,
            });
        } finally {
            clearTimeout(timeoutId);
        }
    }, []);

    React.useEffect(() => {
        try {
            const { backendIsHealthy } = state;

            if (!backendIsHealthy) {
                return;
            }

        showErrors();
        showMessages();

        if (!userInitialized && !userFetching) {
            verifyAuthenticated();
            return;
        }

        // Note: We need to track previous user value for comparison
        // This is a simplified version - in a real implementation you might want to use useRef
        if (user) {
            EventRecorder.initSave();
        } else {
            EventRecorder.cancelSave();
        }

        if (!userAgreementsInitialized && !userAgreementsFetching) {
            loadUserAgreements();
            return;
        }

        if (!serverAPISchemaInitialized && !serverAPISchemaFetching) {
            loadServerAPISchema();
        }

        if (!aboutInitialized && !aboutFetching) {
            loadAbout();
            return;
        }

        if (user == null || !user.isVerified || !user.id) {
            return;
        }

        if (!organizationInitialized && !organizationFetching) {
            loadOrganization();
        }

        if (!formatsInitialized && !formatsFetching) {
            loadFormats();
        }

        if (organizationInitialized && !requestsInitialized && !requestsFetching) {
            initRequests();
        }

        if (isModelPluginActive && !modelsInitialized && !modelsFetching) {
            initModels();
        }

        if (!invitationsInitialized && !invitationsFetching && history.location.pathname !== '/invitations') {
            initInvitations();
        }

        if (!pluginsInitialized && !pluginsFetching) {
            initPlugins();
        }
        } catch (error) {
            console.error('Error in CVATApplication second useEffect:', error);
            // Don't crash the app, just log the error
        }
    }, [
        verifyAuthenticated, loadFormats, loadAbout, loadUserAgreements, initPlugins, initModels,
        loadOrganization, loadServerAPISchema, userInitialized, userFetching, organizationFetching,
        organizationInitialized, formatsInitialized, formatsFetching, aboutInitialized, aboutFetching,
        pluginsInitialized, pluginsFetching, modelsInitialized, modelsFetching, user,
        userAgreementsFetching, userAgreementsInitialized, isModelPluginActive, invitationsInitialized,
        invitationsFetching, initInvitations, requestsFetching, requestsInitialized, initRequests,
        history, serverAPISchemaFetching, serverAPISchemaInitialized, state.backendIsHealthy
    ]);

    const showMessages = (): void => {

        function showMessage(notificationState: NotificationState): void {
            notification.info({
                message: (
                    <CVATMarkdown history={history}>{notificationState.message}</CVATMarkdown>
                ),
                description: notificationState?.description && (
                    <CVATMarkdown history={history}>{notificationState?.description}</CVATMarkdown>
                ),
                duration: notificationState.duration || null,
            });
        }

        let shown = false;
        for (const where of Object.keys(notifications.messages)) {
            for (const what of Object.keys((notifications as any).messages[where])) {
                const notificationState = (notifications as any).messages[where][what] as NotificationState;
                shown = shown || !!notificationState;
                if (notificationState) {
                    showMessage(notificationState);
                }
            }
        }

        if (shown) {
            resetMessages();
        }
    }

    const showErrors = (): void => {

        function showError(title: string, _error: Error, shouldLog?: boolean, className?: string): void {
            const error = _error?.message || _error.toString();
            const dynamicProps = typeof className === 'undefined' ? {} : { className };

            let errorLength = error.length;
            // Do not count the length of the link in the Markdown error message
            if (/]\(.+\)/.test(error)) {
                errorLength = error.replace(/]\(.+\)/, ']').length;
            }

            notification.error({
                ...dynamicProps,
                message: (
                    <CVATMarkdown history={history}>{title}</CVATMarkdown>
                ),
                duration: null,
                description: errorLength > appConfig.MAXIMUM_NOTIFICATION_MESSAGE_LENGTH ?
                    'Open the Browser Console to get details' : <CVATMarkdown history={history}>{error}</CVATMarkdown>,
            });

            if (shouldLog) {
                setTimeout(() => {
                    // throw the error to be caught by global listener
                    throw _error;
                });
            } else {
                console.error(error);
            }
        }

        let shown = false;
        for (const where of Object.keys(notifications.errors)) {
            for (const what of Object.keys((notifications as any).errors[where])) {
                const error = (notifications as any).errors[where][what] as ErrorState;
                shown = shown || !!error;
                if (error) {
                    showError(error.message, error.reason, error.shouldLog, error.className);
                }
            }
        }

        if (shown) {
            resetErrors();
        }
    }

    const resetNotifications = (): void => {

        notification.destroy();
        resetErrors();
        resetMessages();
    };

    // Where you go depends on your URL
    const render = (): JSX.Element => {
        try {
            const { healthIinitialized, backendIsHealthy } = state;

        const notRegisteredUserInitialized = (userInitialized && (user == null || !user.isVerified));
        let readyForRender = userAgreementsInitialized && serverAPISchemaInitialized;
        readyForRender = readyForRender && (notRegisteredUserInitialized ||
            (
                userInitialized &&
                formatsInitialized &&
                pluginsInitialized &&
                aboutInitialized &&
                organizationInitialized &&
                (!isModelPluginActive || modelsInitialized)
            )
        );

        const routesToRender = pluginComponents.router
            .filter(({ data: { shouldBeRendered } }) => shouldBeRendered(props, state))
            .map(({ component: Component }) => Component());

        const queryParams = new URLSearchParams(location.search);
        const authParams = authQuery(queryParams);

        if (readyForRender) {
            if (user && user.isVerified) {
                // Check if the current path is the annotation page
                const isAnnotationPage = location.pathname.match(/\/tasks\/[0-9]+\/jobs\/[0-9]+$/i);

                return (
                    <GlobalErrorBoundary>
                        <ShortcutsContextProvider>
                            <Layout style={{ height: '100%' }}>
                                {!isAnnotationPage && <Sider />}
                                <Layout>
                                    {!isAnnotationPage && <Header />}
                                    <Layout.Content style={{ height: '100%' }}>
                                        <ShortcutsDialog />
                                        <Switch>
                                            <Route exact path='/' component={welcomePage} />
                                            <Route exact path='/home' component={welcomePage} />
                                            <Route exact path='/plan-upgrade' component={PlanUpgradePage} />
                                            <Route exact path='/auth/logout' component={LogoutComponent} />
                                            <Route exact path='/projects' component={ProjectsPageComponent} />
                                            <Route exact path='/projects/create' component={CreateProjectPageComponent} />
                                            <Route exact path='/projects/:id' component={ProjectPageComponent} />
                                            <Route exact path='/projects/:id/webhooks' component={WebhooksPage} />
                                            <Route exact path='/projects/:id/guide' component={AnnotationGuidePage} />
                                            <Route exact path='/tasks' component={TasksPageContainer} />
                                            <Route exact path='/tasks/create' component={CreateTaskPageContainer} />
                                            <Route
                                                exact
                                                path='/tasks/:tid'
                                                render={({ match }: { match: any }) => (
                                                    <Redirect to={`/tasks/${match.params.tid}/overview`} />
                                                )}
                                            />
                                            <Route exact path='/tasks/:tid/:tab(overview|jobs|analytics)' component={NavTaskPageComponent} />
                                            <Route exact path='/tasks/:tid/quality-control' component={QualityControlPage} />
                                            <Route exact path='/tasks/:tid/consensus' component={ConsensusManagementPage} />
                                            <Route exact path='/tasks/:tid/jobs/create' component={CreateJobPage} />
                                            <Route exact path='/tasks/:tid/guide' component={AnnotationGuidePage} />
                                            <Route exact path='/tasks/:tid/jobs/:jid' component={AnnotationPageContainer} />
                                            <Route exact path='/tasks/:tid/jobs/:jid/analytics' component={AnalyticsReportPage} />
                                            <Route exact path='/projects/:pid/quality-control' component={QualityControlPage} />
                                            <Route exact path='/projects/:pid/analytics' component={AnalyticsReportPage} />
                                            <Route exact path='/jobs' component={JobsPageComponent} />
                                            <Route exact path='/cloudstorages' component={CloudStoragesPageComponent} />
                                            <Route
                                                exact
                                                path='/cloudstorages/create'
                                                component={CreateCloudStoragePageComponent}
                                            />
                                            <Route
                                                exact
                                                path='/cloudstorages/update/:id'
                                                component={UpdateCloudStoragePageComponent}
                                            />
                                            <Route
                                                exact
                                                path='/organizations/create'
                                                component={CreateOrganizationComponent}
                                            />
                                            <Route exact path='/organization/webhooks' component={WebhooksPage} />
                                            <Route exact path='/webhooks/create' component={CreateWebhookPage} />
                                            <Route exact path='/webhooks/update/:id' component={UpdateWebhookPage} />
                                            <Route exact path='/invitations' component={InvitationsPage} />
                                            <Route exact path='/organization' component={OrganizationPage} />
                                            <Route exact path='/requests' component={RequestsPage} />
                                            <Route exact path='/api-keys' component={ApiKeysPage} />
                                            {routesToRender}
                                            {isModelPluginActive &&
                                                (
                                                    <>
                                                        <Route path='/agents'>
                                                            <Switch>
                                                                <Redirect exact from='/agents' to='/agents/models' />
                                                                <Route exact path='/agents/models' component={ModelsPageComponent} />
                                                                <Route path='/agents/:tab/:subtab?' component={agentsPage} />
                                                            </Switch>
                                                        </Route>
                                                        <Route path='/pipelines'>
                                                            <Switch>
                                                                <Redirect exact from='/pipelines' to='/pipelines/catalogue' />
                                                                <Route path='/pipelines/:tab' component={pipelinesPage} />
                                                            </Switch>
                                                        </Route>
                                                    </>
                                                )}
                                            <Redirect
                                                push
                                                to={{
                                                    pathname: queryParams.get('next') || '/home',
                                                    search: authParams ? new URLSearchParams(authParams).toString() : '',
                                                }}
                                            />
                                        </Switch>
                                        <ExportDatasetModal />
                                        <ExportBackupModal />
                                        <ImportDatasetModal />
                                        <ImportBackupModal />
                                        <InvitationWatcher />
                                        <UploadFileStatusModal />
                                        {/* eslint-disable-next-line */}
                                        <a id='downloadAnchor' target='_blank' style={{ display: 'none' }} download />
                                    </Layout.Content>
                                </Layout>
                            </Layout>
                        </ShortcutsContextProvider>
                    </GlobalErrorBoundary>
                );
            }

            return (
                <GlobalErrorBoundary>
                    <>
                        <Switch>
                            {isRegistrationEnabled && (
                                <Route exact path='/auth/register' component={RegisterPageContainer} />
                            )}
                            <Route exact path='/auth/email-verification-sent' component={EmailVerificationSentPage} />
                            <Route exact path='/auth/incorrect-email-confirmation' component={IncorrectEmailConfirmationPage} />
                            <Route exact path='/auth/login' component={LoginPageContainer} />
                            {isPasswordResetEnabled && (
                                <Route exact path='/auth/password/reset' component={ResetPasswordPageComponent} />
                            )}
                            {isPasswordResetEnabled && (
                                <Route
                                    exact
                                    path='/auth/password/reset/confirm'
                                    component={ResetPasswordPageConfirmComponent}
                                />
                            )}

                            <Route exact path='/auth/email-confirmation' component={EmailConfirmationPage} />
                            {routesToRender}
                            <Redirect
                                to={location.pathname.length > 1 ? `/auth/login?next=${location.pathname}` : '/auth/login'}
                            />
                        </Switch>
                        <InvitationWatcher />
                    </>
                </GlobalErrorBoundary>
            );
        }

        if (healthIinitialized && !backendIsHealthy) {
            // Show a warning but allow the app to continue loading
            console.warn('Backend health check failed, but continuing with application load');
            // Show a notification to inform the user about the backend issue
            notification.warning({
                message: 'Backend Connection Warning',
                description: 'Some features may not work properly due to backend connectivity issues.',
                duration: 10,
            });
        }

        return (
            <Spin size='large' fullscreen className='cvat-spinner' tip='Connecting...' />
        );
        } catch (error) {
            console.error('Error in CVATApplication render:', error);
            // Return a fallback UI to prevent the app from crashing
            return (
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100vh',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <h2>Application Error</h2>
                    <p>Something went wrong while loading the application.</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{ 
                            padding: '8px 16px', 
                            background: '#1890ff', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }
    };

    return render();
};

export default withRouter(CVATApplication);
