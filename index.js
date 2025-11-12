'use strict';

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  Vibration,
  View,
} from 'react-native';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { BarcodeFormat, useScanBarcodes } from 'vision-camera-code-scanner';

/**
 * 🧩 Functional VisionCamera Wrapper
 * This component handles live QR scanning using VisionCamera + code-scanner.
 */
function VisionCameraView({
  onRead,
  isActive,
  showMarker,
  customMarker,
  markerStyle,
  cameraStyle,
  cameraType,
}) {
  const devices = useCameraDevices();
  const device = cameraType === 'front' ? devices.front : devices.back;

  const [frameProcessor, barcodes] = useScanBarcodes([BarcodeFormat.QR_CODE], {
    checkInverted: true,
  });

  React.useEffect(
    () => {
      if (barcodes.length > 0) {
        const qrValue = barcodes[0]?.rawValue;
        if (qrValue) {
          onRead?.({ data: qrValue });
        }
      }
    },
    [barcodes]
  );

  if (!device) {
    return (
      <View style={styles.loader}>
        <Text>Loading Camera...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.camera, cameraStyle]}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
        frameProcessorFps={5}
      />
      {showMarker &&
        (customMarker ? (
          customMarker
        ) : (
          <View style={styles.rectangleContainer}>
            <View
              style={[styles.rectangle, markerStyle ? markerStyle : null]}
            />
          </View>
        ))}
    </View>
  );
}

export default class QRCodeScanner extends Component {
  static propTypes = {
    onRead: PropTypes.func.isRequired,
    vibrate: PropTypes.bool,
    reactivate: PropTypes.bool,
    reactivateTimeout: PropTypes.number,
    cameraTimeout: PropTypes.number,
    fadeIn: PropTypes.bool,
    showMarker: PropTypes.bool,
    cameraType: PropTypes.oneOf(['front', 'back']),
    customMarker: PropTypes.element,
    containerStyle: PropTypes.any,
    cameraStyle: PropTypes.any,
    cameraContainerStyle: PropTypes.any,
    markerStyle: PropTypes.any,
    topViewStyle: PropTypes.any,
    bottomViewStyle: PropTypes.any,
    topContent: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
    bottomContent: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
    permissionDialogTitle: PropTypes.string,
    permissionDialogMessage: PropTypes.string,
    buttonPositive: PropTypes.string,
    checkAndroid6Permissions: PropTypes.bool,
    cameraProps: PropTypes.object,
  };

  static defaultProps = {
    onRead: () => null,
    reactivate: false,
    vibrate: true,
    reactivateTimeout: 0,
    cameraTimeout: 0,
    fadeIn: true,
    showMarker: false,
    cameraType: 'back',
    permissionDialogTitle: 'Info',
    permissionDialogMessage: 'Need camera permission',
    buttonPositive: 'OK',
    checkAndroid6Permissions: false,
    cameraProps: {},
  };

  constructor(props) {
    super(props);
    this.state = {
      scanning: false,
      isCameraActivated: true,
      fadeInOpacity: new Animated.Value(0),
      isAuthorized: false,
      isAuthorizationChecked: false,
      disableVibrationByUser: false,
    };
    this.timer = null;
    this._scannerTimeout = null;
    this._handleBarCodeRead = this._handleBarCodeRead.bind(this);
  }

  async componentDidMount() {
    let granted = false;

    try {
      if (Platform.OS === 'ios') {
        const cameraStatus = await request(PERMISSIONS.IOS.CAMERA);
        granted = cameraStatus === RESULTS.GRANTED;
      } else if (
        Platform.OS === 'android' &&
        this.props.checkAndroid6Permissions
      ) {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: this.props.permissionDialogTitle,
            message: this.props.permissionDialogMessage,
            buttonPositive: this.props.buttonPositive,
          }
        );
        granted = permission === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const cameraPermission = await Camera.requestCameraPermission();
        granted = cameraPermission === 'authorized';
      }
    } catch (err) {
      console.warn('Camera permission error:', err);
    }

    this.setState({
      isAuthorized: granted,
      isAuthorizationChecked: true,
    });

    if (this.props.fadeIn) {
      Animated.timing(this.state.fadeInOpacity, {
        toValue: 1,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
        duration: 800,
      }).start();
    }
  }

  componentWillUnmount() {
    if (this._scannerTimeout) clearTimeout(this._scannerTimeout);
    if (this.timer) clearTimeout(this.timer);
  }

  _handleBarCodeRead(e) {
    const { scanning, disableVibrationByUser } = this.state;
    if (!scanning && !disableVibrationByUser) {
      if (this.props.vibrate) {
        Vibration.vibrate();
      }
      this.setState({ scanning: true });
      this.props.onRead(e);
      if (this.props.reactivate) {
        this._scannerTimeout = setTimeout(
          () => this.setState({ scanning: false }),
          this.props.reactivateTimeout
        );
      }
    }
  }

  _renderCamera() {
    const {
      isAuthorized,
      isAuthorizationChecked,
      isCameraActivated,
    } = this.state;

    if (!isCameraActivated) {
      return (
        <TouchableWithoutFeedback
          onPress={() => this.setState({ isCameraActivated: true })}
        >
          <View style={styles.cameraTimeoutView}>
            <Text style={{ color: 'white' }}>Tap to activate camera</Text>
          </View>
        </TouchableWithoutFeedback>
      );
    }

    if (!isAuthorizationChecked) {
      return (
        <View style={styles.centered}>
          <Text style={styles.infoText}>Requesting camera permission...</Text>
        </View>
      );
    }

    if (!isAuthorized) {
      return (
        <View style={styles.centered}>
          <Text style={styles.infoText}>Camera not authorized</Text>
        </View>
      );
    }

    return (
      <Animated.View
        style={[
          { opacity: this.state.fadeInOpacity },
          this.props.cameraContainerStyle,
        ]}
      >
        <VisionCameraView
          isActive={isCameraActivated}
          onRead={this._handleBarCodeRead}
          showMarker={this.props.showMarker}
          customMarker={this.props.customMarker}
          markerStyle={this.props.markerStyle}
          cameraStyle={this.props.cameraStyle}
          cameraType={this.props.cameraType}
        />
      </Animated.View>
    );
  }

  render() {
    return (
      <View style={[styles.mainContainer, this.props.containerStyle]}>
        <View style={[styles.infoView, this.props.topViewStyle]}>
          {this.props.topContent}
        </View>

        <View style={[{ flex: 1 }, this.props.cameraContainerStyle]}>
          {this._renderCamera()}
        </View>

        <View style={[styles.infoView, this.props.bottomViewStyle]}>
          {this.props.bottomContent}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  infoView: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    width: Dimensions.get('window').width,
  },
  camera: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'black',
  },
  rectangleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rectangle: {
    height: 250,
    width: 250,
    borderWidth: 2,
    borderColor: '#00FF00',
    backgroundColor: 'transparent',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTimeoutView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'black',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#fff',
  },
});
