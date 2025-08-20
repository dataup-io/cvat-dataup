import { connect } from 'react-redux';
import { CombinedState } from 'reducers';
import { hideTextEditor, updateAnnotationsAsync } from 'actions/annotation-actions';
import TextEditorComponent from 'components/annotation-page/text-editor/text-editor';
import { getCVATStore } from 'cvat-store';

interface StateToProps {
    visible: boolean;
    attrID: number | null;
    attrValue: string;
    attrName: string;
    attrInputType: string;
    attrValues: string[];
    originalStateID: number | null; // Store the original state ID when the editor was opened
}

interface DispatchToProps {
    onHide: () => void;
    changeAttribute: (attrID: number, value: string) => void;
}

function mapStateToProps(state: CombinedState): StateToProps {
    const {
        annotation: {
            textEditor: {
                visible, attrID, attrValue, attrName, attrInputType, attrValues, originalStateID,
            },
        },
    } = state;

    return {
        visible,
        attrID,
        attrValue,
        attrName,
        attrInputType,
        attrValues,
        originalStateID,
    };
}

function mapDispatchToProps(dispatch: any): DispatchToProps {
    return {
        onHide: () => dispatch(hideTextEditor()),

        changeAttribute: (attrID: number, value: string) => {
            const state = getCVATStore().getState();
            const { annotation } = state;

            // Use the original state ID that was stored when the editor was opened
            // instead of the currently activated state ID
            const originalStateID = state.annotation.textEditor.originalStateID;
            const objectState = annotation.annotations.states?.find((s: any) => s.clientID === originalStateID);

            if (typeof attrID === 'number' && typeof value === 'string' && objectState) {
                const attr: Record<number, string> = {};
                attr[attrID] = value;
                objectState.attributes = attr;

                dispatch(updateAnnotationsAsync([objectState]));
            }

            dispatch(hideTextEditor());
        },
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TextEditorComponent);
