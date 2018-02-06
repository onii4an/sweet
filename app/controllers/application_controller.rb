class ApplicationController < ActionController::Base
  protect_from_forgery with: :exception
  before_action { |_c| current_boy.track unless current_boy.nil? }
  before_action { |_c| current_girl.track unless current_girl.nil? }
  before_action :configure_permitted_parameters, if: :devise_controller?
  helper_method :current_user

  def current_user
    if current_girl
      current_girl
    elsif current_boy
      current_boy
    end
  end

  protected

  def configure_permitted_parameters
    added_attrs = %i[username email password password_confirmation remember_me name surname age sex avatar avatar_cache remove_avatar]
    devise_parameter_sanitizer.permit :sign_up, keys: added_attrs
    devise_parameter_sanitizer.permit :account_update, keys: added_attrs
  end
end
